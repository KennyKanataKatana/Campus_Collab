const reportPasskeyMiddleware = require('../../src/middlewares/reportPasskeyMiddleware');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

describe('reportPasskeyMiddleware.verifyReportPasskey', () => {
  test('should return 401 when no passkey header is provided', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    reportPasskeyMiddleware.verifyReportPasskey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Passkey is required to view reports'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 when passkey header is an empty string', () => {
    const req = { headers: { 'x-report-passkey': '' } };
    const res = mockRes();
    const next = jest.fn();

    reportPasskeyMiddleware.verifyReportPasskey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 when passkey is wrong', () => {
    const req = { headers: { 'x-report-passkey': 'wrongpasskey' } };
    const res = mockRes();
    const next = jest.fn();

    reportPasskeyMiddleware.verifyReportPasskey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Wrong passkey. Reports are still hidden.'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next when passkey is correct', () => {
    const req = { headers: { 'x-report-passkey': 'campuscollab123' } };
    const res = mockRes();
    const next = jest.fn();

    reportPasskeyMiddleware.verifyReportPasskey(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});