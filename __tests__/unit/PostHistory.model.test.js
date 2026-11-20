const pool = require('../../src/models/db');

const {
    readPostHistoryByUser,
    deletePostHistory
} = require('../../src/models/PostHistoryModel');

// Mock PostgreSQL
jest.mock('../../src/models/db', () => ({
    query: jest.fn()
}));

describe('PostHistory.model unit tests', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    // =====================================================
    // readPostHistoryByUser()
    // =====================================================

    describe('readPostHistoryByUser', () => {

        test('should retrieve archived posts for a user', () => {

            const callback = jest.fn();

            const data = {
                user_id: 1
            };

            readPostHistoryByUser(data, callback);

            expect(pool.query).toHaveBeenCalledTimes(1);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [1],
                callback
            );

        });

        test('should handle user with no archived posts', () => {

            const callback = jest.fn();

            readPostHistoryByUser(
                {
                    user_id: 999
                },
                callback
            );

            expect(pool.query).toHaveBeenCalledWith(
                expect.any(String),
                [999],
                callback
            );

        });

        test('should order history by newest archived first', () => {

            const callback = jest.fn();

            readPostHistoryByUser(
                {
                    user_id: 3
                },
                callback
            );

            expect(pool.query.mock.calls[0][0])
                .toContain('ORDER BY ph.archived_at DESC');

        });

    });



    // =====================================================
    // deletePostHistory()
    // =====================================================

    describe('deletePostHistory', () => {

        test('should delete a history record', () => {

            const callback = jest.fn();

            deletePostHistory(
                {
                    history_id: 5
                },
                callback
            );

            expect(pool.query).toHaveBeenCalledTimes(1);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM post_history'),
                [5],
                callback
            );

        });

        test('should still execute query when history does not exist', () => {

            const callback = jest.fn();

            deletePostHistory(
                {
                    history_id: 999
                },
                callback
            );

            expect(pool.query).toHaveBeenCalledWith(
                expect.any(String),
                [999],
                callback
            );

        });

        test('should pass correct values to delete query', () => {

            const callback = jest.fn();

            deletePostHistory(
                {
                    history_id: 12
                },
                callback
            );

            expect(pool.query.mock.calls[0][1])
                .toEqual([12]);

        });

    });

});