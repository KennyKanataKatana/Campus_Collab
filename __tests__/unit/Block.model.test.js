const pool = require('../../src/models/db');

const {
    readBlocksByUserId,
    blockUser,
    unblockUser,
    searchUsersToBlock
} = require('../../src/models/BlockModel');


// Mock database so no real PostgreSQL is used
jest.mock('../../src/models/db', () => ({
    query: jest.fn()
}));


describe('Block.model unit tests', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });


    // =====================================================
    // readBlocksByUserId()
    // =====================================================

    describe('readBlocksByUserId', () => {

        test('should retrieve blocked users for a user', () => {

            const callback = jest.fn();

            const data = {
                user_id: 1
            };


            readBlocksByUserId(data, callback);


            expect(pool.query).toHaveBeenCalledTimes(1);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [1],
                callback
            );
        });


        test('should handle user with no blocked users', () => {

            const callback = jest.fn();

            readBlocksByUserId(
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

    });



    // =====================================================
    // blockUser()
    // =====================================================

    describe('blockUser', () => {


        test('should insert a new blocked user relationship', () => {

            const callback = jest.fn();


            blockUser(
                {
                    blocker_id: 1,
                    blocked_id: 2
                },
                callback
            );


            expect(pool.query).toHaveBeenCalledTimes(1);


            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    'INSERT INTO blocked_users'
                ),
                [1, 2],
                callback
            );

        });



        test('should pass identical IDs when blocking yourself', () => {

            const callback = jest.fn();


            blockUser(
                {
                    blocker_id: 5,
                    blocked_id: 5
                },
                callback
            );


            expect(pool.query).toHaveBeenCalledWith(
                expect.any(String),
                [5, 5],
                callback
            );

        });

    });



    // =====================================================
    // unblockUser()
    // =====================================================

    describe('unblockUser', () => {


        test('should remove blocked user relationship', () => {

            const callback = jest.fn();


            unblockUser(
                {
                    blocker_id: 1,
                    blocked_id: 2
                },
                callback
            );


            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    'DELETE FROM blocked_users'
                ),
                [1, 2],
                callback
            );

        });



        test('should still execute query when IDs do not exist', () => {

            const callback = jest.fn();


            unblockUser(
                {
                    blocker_id: 999,
                    blocked_id: 888
                },
                callback
            );


            expect(pool.query).toHaveBeenCalledWith(
                expect.any(String),
                [999, 888],
                callback
            );

        });

    });



    // =====================================================
    // searchUsersToBlock()
    // =====================================================

    describe('searchUsersToBlock', () => {


        test('should search users by name excluding blocked users', () => {

            const callback = jest.fn();


            searchUsersToBlock(
                {
                    user_id: 1,
                    search: 'alex'
                },
                callback
            );


            expect(pool.query).toHaveBeenCalledTimes(1);


            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('ILIKE'),
                [
                    '%alex%',
                    1
                ],
                callback
            );

        });



        test('should handle empty search input', () => {

            const callback = jest.fn();


            searchUsersToBlock(
                {
                    user_id: 1,
                    search: ''
                },
                callback
            );


            expect(pool.query).toHaveBeenCalledWith(
                expect.any(String),
                [
                    '%%',
                    1
                ],
                callback
            );

        });



        test('should limit search results to 10 users', () => {

            const callback = jest.fn();


            searchUsersToBlock(
                {
                    user_id: 3,
                    search: 'bob'
                },
                callback
            );


            expect(pool.query.mock.calls[0][0])
                .toContain('LIMIT 10');

        });

    });

});