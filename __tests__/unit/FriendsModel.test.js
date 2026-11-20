jest.mock('../../src/models/db', () => ({ query: jest.fn() }));

const pool = require('../../src/models/db');
const friends = require('../../src/models/friendsModel');

beforeEach(() => jest.resetAllMocks());

describe('friends data model', () => {
  test('rejects an existing relationship and inserts a new friend request', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await expect(friends.sendFriendRequest(1, 2)).rejects.toThrow(
      'This user is already your friend or has a pending request.',
    );

    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ id: 4, sender_id: 1, receiver_id: 2, status: 'PENDING' }],
    });
    await expect(friends.sendFriendRequest(1, 2)).resolves.toMatchObject({
      id: 4,
      status: 'PENDING',
    });
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO friend_requests'),
      [1, 2],
    );
  });

  test.each([
    ['accepts a pending request', friends.acceptFriendRequest, [4, 2], { id: 4 }],
    ['rejects a pending request', friends.rejectFriendRequest, [4, 2], { id: 4 }],
    ['returns received requests', friends.getPendingRequests, [2], [{ id: 4 }]],
    ['returns accepted friends', friends.getFriendsList, [2], [{ id: 4 }]],
    ['returns sent requests', friends.getSentRequests, [1], [{ id: 4 }]],
    ['searches users by a name fragment', friends.searchUsers, ['ari'], [{ id: 4 }]],
    ['returns suggested friends', friends.getSuggestedFriends, [1], [{ id: 4 }]],
    ['removes an accepted friend relationship', friends.removeFriend, [4, 1], { id: 4 }],
    ['returns friendship metadata', friends.getFriendshipInfo, [1, 2], { id: 4 }],
  ])('%s', async (_name, operation, args, expected) => {
    pool.query.mockResolvedValue({ rows: [{ id: 4 }] });
    await expect(operation(...args)).resolves.toEqual(expected);
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
  });

  test('returns the mutual friend count for a profile', async () => {
    pool.query.mockResolvedValue({ rows: [{ mutual_count: 2 }] });
    await expect(friends.getMutualFriendCount(1, 3)).resolves.toBe(2);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('mutual_count'), [1, 3]);
  });
});
