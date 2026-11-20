jest.mock('../../src/models/friendsModel', () => ({
  sendFriendRequest: jest.fn(),
  acceptFriendRequest: jest.fn(),
  rejectFriendRequest: jest.fn(),
  getPendingRequests: jest.fn(),
  getFriendsList: jest.fn(),
  getSentRequests: jest.fn(),
  searchUsers: jest.fn(),
  getSuggestedFriends: jest.fn(),
  removeFriend: jest.fn(),
  getMutualFriendCount: jest.fn(),
}));

const model = require('../../src/models/friendsModel');
const controller = require('../../src/controllers/friendsController');

function response(userId = 7) {
  const res = { locals: { userId }, status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function request({ body = {}, params = {} } = {}) {
  return { body, params };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('friend request actions', () => {
  test('validates, creates, and maps request failures', async () => {
    let res = response();
    await controller.sendRequest(request({ body: { receiver_id: 0 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);

    res = response();
    await controller.sendRequest(request({ body: { receiver_id: 7 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);

    res = response();
    model.sendFriendRequest.mockRejectedValue(
      new Error('This user is already your friend or has a pending request.'),
    );
    await controller.sendRequest(request({ body: { receiver_id: 8 } }), res);
    expect(res.status).toHaveBeenCalledWith(409);

    res = response();
    model.sendFriendRequest.mockRejectedValue(new Error('database unavailable'));
    await controller.sendRequest(request({ body: { receiver_id: 8 } }), res);
    expect(res.status).toHaveBeenCalledWith(500);

    res = response();
    model.sendFriendRequest.mockResolvedValue({ id: 1, status: 'PENDING' });
    await controller.sendRequest(request({ body: { receiver_id: 8 } }), res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test.each([
    ['acceptRequest', 'acceptFriendRequest', 'Pending friend request not found.'],
    ['rejectRequest', 'rejectFriendRequest', 'Pending friend request not found.'],
    ['removeFriend', 'removeFriend', 'Friend relationship not found.'],
  ])(
    '%s validates IDs and handles missing, failed, and successful changes',
    async (handlerName, modelMethod, missingMessage) => {
      let res = response();
      await controller[handlerName](request({ params: { id: 'invalid' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);

      res = response();
      model[modelMethod].mockResolvedValue(undefined);
      await controller[handlerName](request({ params: { id: 4 } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenLastCalledWith({ error: missingMessage });

      res = response();
      model[modelMethod].mockRejectedValue(new Error('database unavailable'));
      await controller[handlerName](request({ params: { id: 4 } }), res);
      expect(res.status).toHaveBeenCalledWith(500);

      res = response();
      model[modelMethod].mockResolvedValue({ id: 4, status: 'ACCEPTED' });
      await controller[handlerName](request({ params: { id: 4 } }), res);
      expect(res.json).toHaveBeenCalled();
    },
  );
});

describe('friend lists and discovery', () => {
  test.each([
    ['getPending', 'getPendingRequests'],
    ['getFriends', 'getFriendsList'],
    ['getSent', 'getSentRequests'],
  ])(
    '%s permits only the authenticated user and maps model outcomes',
    async (handlerName, modelMethod) => {
      let res = response();
      await controller[handlerName](request({ params: { userId: 0 } }), res);
      expect(res.status).toHaveBeenCalledWith(403);

      res = response();
      await controller[handlerName](request({ params: { userId: 8 } }), res);
      expect(res.status).toHaveBeenCalledWith(403);

      res = response();
      model[modelMethod].mockRejectedValue(new Error('database unavailable'));
      await controller[handlerName](request({ params: { userId: 7 } }), res);
      expect(res.status).toHaveBeenCalledWith(500);

      res = response();
      model[modelMethod].mockResolvedValue([{ id: 1 }]);
      await controller[handlerName](request({ params: { userId: 7 } }), res);
      expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    },
  );

  test.each([
    ['searchUsers', 'searchUsers', request({ params: { name: 'ari' } }), [{ id: 1 }]],
    ['getSuggestions', 'getSuggestedFriends', request(), [{ id: 2 }]],
    ['getProfile', 'getMutualFriendCount', request({ params: { id: 2 } }), 3],
  ])(
    '%s returns discovery results and reports lookup errors',
    async (handlerName, modelMethod, req, data) => {
      let res = response();
      model[modelMethod].mockRejectedValue(new Error('database unavailable'));
      await controller[handlerName](req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      res = response();
      model[modelMethod].mockResolvedValue(data);
      await controller[handlerName](req, res);
      expect(res.json).toHaveBeenCalled();
    },
  );
});
