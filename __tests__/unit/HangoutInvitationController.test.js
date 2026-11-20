jest.mock('../../src/models/HangoutInvitationModel', () => ({
  createInvitation: jest.fn(),
  getReceivedInvitations: jest.fn(),
  getSentInvitations: jest.fn(),
  getInvitableFriends: jest.fn(),
  isPostOwner: jest.fn(),
  acceptInvitation: jest.fn(),
  getInvitationById: jest.fn(),
  declineInvitation: jest.fn(),
  cancelInvitation: jest.fn(),
}));

const invitationModel = require('../../src/models/HangoutInvitationModel');
const controller = require('../../src/controllers/HangoutInvitationController');

function createRequest({ body = {}, params = {} } = {}) {
  return { body, params };
}

function createResponse(userId = 7) {
  const response = {
    locals: { userId },
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

function error(message, code) {
  return Object.assign(new Error(message), { code });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('createInvitation', () => {
  test.each([
    [{ post_id: 0, receiver_id: 2 }],
    [{ post_id: 1, receiver_id: 'abc' }],
    [{ post_id: 1, receiver_id: 7 }],
  ])('rejects invalid invitation input', async (body) => {
    const res = createResponse();

    await controller.createInvitation(createRequest({ body }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(invitationModel.createInvitation).not.toHaveBeenCalled();
  });

  test('creates a valid invitation', async () => {
    const invitation = { id: 21, status: 'PENDING' };
    invitationModel.createInvitation.mockResolvedValue(invitation);
    const res = createResponse();

    await controller.createInvitation(
      createRequest({ body: { post_id: '3', receiver_id: '8' } }),
      res,
    );

    expect(invitationModel.createInvitation).toHaveBeenCalledWith('3', 7, '8');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(invitation);
  });

  test.each([
    [error('duplicate', '23505'), 409],
    [error('missing reference', '23503'), 400],
    [error('invalid check', '23514'), 400],
    [error('This hangout is already full.'), 409],
    [error('Only the hangout owner can invite friends.'), 403],
    [error('You can only invite accepted friends.'), 400],
    [error('Hangout not found.'), 404],
    [error('database unavailable'), 500],
  ])('maps model failures to the correct response', async (modelError, status) => {
    invitationModel.createInvitation.mockRejectedValue(modelError);
    const res = createResponse();

    await controller.createInvitation(createRequest({ body: { post_id: 3, receiver_id: 8 } }), res);

    expect(res.status).toHaveBeenCalledWith(status);
  });
});

describe('invitation lists and picker', () => {
  test.each([
    ['getReceived', 'getReceivedInvitations'],
    ['getSent', 'getSentInvitations'],
  ])('%s returns the model result and reports failures', async (handler, method) => {
    const res = createResponse();
    invitationModel[method].mockResolvedValue([{ id: 1 }]);

    await controller[handler](createRequest(), res);

    expect(invitationModel[method]).toHaveBeenCalledWith(7);
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);

    invitationModel[method].mockRejectedValue(new Error('database unavailable'));
    const failedRes = createResponse();
    await controller[handler](createRequest(), failedRes);
    expect(failedRes.status).toHaveBeenCalledWith(500);
  });

  test('validates ownership before returning invitable friends', async () => {
    let res = createResponse();
    await controller.getInvitableFriends(createRequest({ params: { postId: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);

    invitationModel.isPostOwner.mockResolvedValue(false);
    res = createResponse();
    await controller.getInvitableFriends(createRequest({ params: { postId: 4 } }), res);
    expect(res.status).toHaveBeenCalledWith(403);

    invitationModel.isPostOwner.mockResolvedValue(true);
    invitationModel.getInvitableFriends.mockResolvedValue([{ id: 8 }]);
    res = createResponse();
    await controller.getInvitableFriends(createRequest({ params: { postId: 4 } }), res);
    expect(invitationModel.getInvitableFriends).toHaveBeenCalledWith(7, 4);
    expect(res.json).toHaveBeenCalledWith([{ id: 8 }]);
  });

  test('reports unexpected picker failures', async () => {
    invitationModel.isPostOwner.mockRejectedValue(new Error('database unavailable'));
    const res = createResponse();

    await controller.getInvitableFriends(createRequest({ params: { postId: 4 } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('acceptInvitation', () => {
  test('validates the invitation ID and accepts a pending invitation', async () => {
    let res = createResponse();
    await controller.acceptInvitation(createRequest({ params: { id: '0' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);

    invitationModel.acceptInvitation.mockResolvedValue({ id: 4, status: 'ACCEPTED' });
    res = createResponse();
    await controller.acceptInvitation(createRequest({ params: { id: 4 } }), res);
    expect(invitationModel.acceptInvitation).toHaveBeenCalledWith(4, 7);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invitation accepted successfully.',
      invitation: { id: 4, status: 'ACCEPTED' },
    });
  });

  test.each([
    ['Invitation not found.', 404],
    ['You are not allowed to accept this invitation.', 403],
    ['This invitation is no longer pending.', 409],
    ['This invitation has expired.', 409],
    ['This hangout is already full.', 409],
    ['You are already participating in another hangout.', 409],
    ['database unavailable', 500],
  ])('maps %s to HTTP %i', async (message, status) => {
    invitationModel.acceptInvitation.mockRejectedValue(new Error(message));
    const res = createResponse();

    await controller.acceptInvitation(createRequest({ params: { id: 4 } }), res);

    expect(res.status).toHaveBeenCalledWith(status);
  });
});

describe.each([
  [
    'declineInvitation',
    'declineInvitation',
    'receiver_id',
    'You are not allowed to decline this invitation.',
    'Invitation declined successfully.',
  ],
  [
    'cancelInvitation',
    'cancelInvitation',
    'sender_id',
    'You are not allowed to cancel this invitation.',
    'Invitation cancelled successfully.',
  ],
])('%s', (handler, modelMethod, actorField, unauthorizedMessage, successMessage) => {
  test('validates, authorizes, updates, and handles failures', async () => {
    let res = createResponse();
    await controller[handler](createRequest({ params: { id: 'bad' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);

    invitationModel.getInvitationById.mockResolvedValue(undefined);
    res = createResponse();
    await controller[handler](createRequest({ params: { id: 4 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);

    invitationModel.getInvitationById.mockResolvedValue({ [actorField]: 8, status: 'PENDING' });
    res = createResponse();
    await controller[handler](createRequest({ params: { id: 4 } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: unauthorizedMessage });

    invitationModel.getInvitationById.mockResolvedValue({ [actorField]: 7, status: 'ACCEPTED' });
    res = createResponse();
    await controller[handler](createRequest({ params: { id: 4 } }), res);
    expect(res.status).toHaveBeenCalledWith(409);

    invitationModel.getInvitationById.mockResolvedValue({ [actorField]: 7, status: 'PENDING' });
    invitationModel[modelMethod].mockResolvedValue(undefined);
    res = createResponse();
    await controller[handler](createRequest({ params: { id: 4 } }), res);
    expect(res.status).toHaveBeenCalledWith(409);

    invitationModel[modelMethod].mockResolvedValue({ id: 4, status: 'DECLINED' });
    res = createResponse();
    await controller[handler](createRequest({ params: { id: 4 } }), res);
    expect(invitationModel[modelMethod]).toHaveBeenCalledWith(4, 7);
    expect(res.json).toHaveBeenCalledWith({
      message: successMessage,
      invitation: { id: 4, status: 'DECLINED' },
    });

    invitationModel.getInvitationById.mockRejectedValue(new Error('database unavailable'));
    res = createResponse();
    await controller[handler](createRequest({ params: { id: 4 } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
