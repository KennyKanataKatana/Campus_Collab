const pool = require('../../src/models/db');

const {
    readBookMarksByUserId,
    cancelBookMark
} = require('../../src/models/BookMarkModel');

// Mock PostgreSQL
jest.mock('../../src/models/db', () => ({
    query: jest.fn()
}));

describe('BookMark.model unit tests', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    // =====================================================
    // readBookMarksByUserId()
    // =====================================================

    describe('readBookMarksByUserId', () => {

        test('should retrieve bookmarked posts for a user', () => {

            const callback = jest.fn();

            const data = {
                user_id: 1
            };

            readBookMarksByUserId(data, callback);

            expect(pool.query).toHaveBeenCalledTimes(1);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [1],
                callback
            );

        });

        test('should handle user with no bookmarked posts', () => {

            const callback = jest.fn();

            readBookMarksByUserId(
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

        test('should order bookmarks by newest first', () => {

            const callback = jest.fn();

            readBookMarksByUserId(
                {
                    user_id: 3
                },
                callback
            );

            expect(pool.query.mock.calls[0][0])
                .toContain('ORDER BY bookmarked_posts.bookmarked_at DESC');

        });

    });



    // =====================================================
    // cancelBookMark()
    // =====================================================

    describe('cancelBookMark', () => {

        test('should remove a bookmarked post', () => {

            const callback = jest.fn();

            cancelBookMark(
                {
                    post_id: 5,
                    user_id: 1
                },
                callback
            );

            expect(pool.query).toHaveBeenCalledTimes(1);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM bookmarked_posts'),
                [5, 1],
                callback
            );

        });

        test('should still execute query when bookmark does not exist', () => {

            const callback = jest.fn();

            cancelBookMark(
                {
                    post_id: 999,
                    user_id: 888
                },
                callback
            );

            expect(pool.query).toHaveBeenCalledWith(
                expect.any(String),
                [999, 888],
                callback
            );

        });

        test('should pass correct values to delete query', () => {

            const callback = jest.fn();

            cancelBookMark(
                {
                    post_id: 12,
                    user_id: 7
                },
                callback
            );

            expect(pool.query.mock.calls[0][1])
                .toEqual([12, 7]);

        });

    });

});