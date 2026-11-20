jest.mock('../../src/models/db', () => ({
  connect: jest.fn(),
  query: jest.fn(),
}));

const pool = require('../../src/models/db');
const invitationModel = require('../../src/models/HangoutInvitationModel');

function createClient() {
  return { query: jest.fn(), release: jest.fn() };
}

function futurePost(overrides = {}) {
  return {
    id: 3,
    title: 'Study Session',
    user_id: 1,
    hangout_at: new Date(Date.now() + 86_400_000).toISOString(),
    max_participants: 3,
    participant_count: 1,
    ...overrides,
  };
}

beforeEach(() => jest.resetAllMocks());

describe('createInvitation', () => {
  test('creates an invitation and notification in one transaction', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [futurePost()] })
      .mockResolvedValueOnce({ rows: [{ exists: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 12, status: 'PENDING' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await expect(invitationModel.createInvitation(3, 1, 2)).resolves.toEqual({
      id: 12,
      status: 'PENDING',
    });

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      expect.arrayContaining([2, 1, 3, 12]),
    );
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['a missing post', undefined, 'Hangout not found.'],
    [
      'a non-owner sender',
      futurePost({ user_id: 9 }),
      'Only the hangout owner can invite friends.',
    ],
    ['a self-invitation', futurePost(), 'You cannot invite yourself.', 1],
    [
      'an expired hangout',
      futurePost({ hangout_at: new Date(Date.now() - 1_000).toISOString() }),
      'This hangout has already started or expired.',
    ],
    ['a full hangout', futurePost({ participant_count: 3 }), 'This hangout is already full.'],
  ])('%s rolls back and releases the client', async (_label, post, message, receiverId = 2) => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: post ? [post] : [] });

    await expect(invitationModel.createInvitation(3, 1, receiverId)).rejects.toThrow(message);

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['requires an accepted friendship', { rows: [] }, 'You can only invite accepted friends.'],
    [
      'rejects an existing participant',
      { rows: [{ id: 1 }] },
      'This friend has already joined the hangout.',
    ],
    [
      'rejects a pending duplicate',
      { rows: [{ id: 1 }] },
      'A pending invitation has already been sent to this user.',
    ],
  ])('%s', async (_label, checkResult, message) => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [futurePost()] });

    if (message === 'You can only invite accepted friends.') {
      client.query.mockResolvedValueOnce(checkResult);
    } else if (message === 'This friend has already joined the hangout.') {
      client.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce(checkResult);
    } else {
      client.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(checkResult);
    }

    await expect(invitationModel.createInvitation(3, 1, 2)).rejects.toThrow(message);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe('read and list helpers', () => {
  test('checks post ownership', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 3 }] }).mockResolvedValueOnce({ rows: [] });

    await expect(invitationModel.isPostOwner(3, 1)).resolves.toBe(true);
    await expect(invitationModel.isPostOwner(3, 2)).resolves.toBe(false);
  });

  test.each([
    ['getInvitationById', [4], { id: 4 }],
    ['getReceivedInvitations', [2], [{ id: 4 }]],
    ['getSentInvitations', [1], [{ id: 4 }]],
    ['getInvitableFriends', [1, 3], [{ id: 2 }]],
  ])('%s expires stale invitations before returning rows', async (method, args, expected) => {
    pool.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: Array.isArray(expected) ? expected : [expected] });

    await expect(invitationModel[method](...args)).resolves.toEqual(expected);
    expect(pool.query.mock.calls[0][0]).toEqual(
      expect.stringContaining('UPDATE hangout_invitations'),
    );
  });

  test('returns updated records when invitations are declined or cancelled', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 4, status: 'DECLINED' }] })
      .mockResolvedValueOnce({ rows: [{ id: 5, status: 'CANCELLED' }] });

    await expect(invitationModel.declineInvitation(4, 2)).resolves.toMatchObject({
      status: 'DECLINED',
    });
    await expect(invitationModel.cancelInvitation(5, 1)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
  });
});

describe('acceptInvitation', () => {
  test('accepts an invitation, records participation, and notifies the sender', async () => {
    const client = createClient();
    pool.query.mockResolvedValueOnce({});
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: 4,
            post_id: 3,
            sender_id: 1,
            receiver_id: 2,
            status: 'PENDING',
            expires_at: new Date(Date.now() + 86_400_000).toISOString(),
            hangout_at: new Date(Date.now() + 86_400_000).toISOString(),
            max_participants: 3,
            participant_count: 1,
            title: 'Study Session',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 4, status: 'ACCEPTED' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await expect(invitationModel.acceptInvitation(4, 2)).resolves.toEqual({
      id: 4,
      status: 'ACCEPTED',
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO hangout_acceptances'),
      [3, 2],
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['a missing invitation', undefined, 'Invitation not found.'],
    [
      'an invitation for another user',
      {
        id: 4,
        receiver_id: 8,
        status: 'PENDING',
      },
      'You are not allowed to accept this invitation.',
    ],
    [
      'a non-pending invitation',
      {
        id: 4,
        receiver_id: 2,
        status: 'DECLINED',
      },
      'This invitation is no longer pending.',
    ],
  ])('%s rolls back the transaction', async (_label, invitation, message) => {
    const client = createClient();
    pool.query.mockResolvedValueOnce({});
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: invitation ? [invitation] : [] });

    await expect(invitationModel.acceptInvitation(4, 2)).rejects.toThrow(message);

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
