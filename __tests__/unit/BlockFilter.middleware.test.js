const { filterBlocked } = require('../../src/middlewares/blockFilter');
const model = require('../../src/models/BlockModel');


jest.mock('../../src/models/BlockModel');


describe('blockFilter middleware unit tests', () => {

    let req;
    let res;
    let next;


    beforeEach(() => {

        req = {};

        res = {
            locals: {
                userId: 1
            },
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        next = jest.fn();

        jest.clearAllMocks();

    });



    // =====================================================
    // SUCCESS CASE
    // =====================================================

    test('should create block list and call next()', () => {


        model.readBlocksByUserId.mockImplementation(
            (data, callback) => {

                callback(null, {
                    rows: [
                        {
                            blocked_id: 2
                        },
                        {
                            blocked_id: 5
                        }
                    ]
                });

            }
        );


        filterBlocked(req, res, next);



        expect(res.locals.blockList)
            .toEqual([2, 5]);


        expect(next)
            .toHaveBeenCalledTimes(1);


    });






    // =====================================================
    // EMPTY BLOCK LIST
    // =====================================================

    test('should create empty block list when user has no blocked users', () => {


        model.readBlocksByUserId.mockImplementation(
            (data, callback) => {

                callback(null, {
                    rows: []
                });

            }
        );



        filterBlocked(req, res, next);



        expect(res.locals.blockList)
            .toEqual([]);


        expect(next)
            .toHaveBeenCalledTimes(1);


    });







    // =====================================================
    // DATABASE ERROR
    // =====================================================

    test('should return 500 when model fails', () => {


        model.readBlocksByUserId.mockImplementation(
            (data, callback) => {

                callback(new Error("Database error"));

            }
        );



        filterBlocked(req, res, next);



        expect(res.status)
            .toHaveBeenCalledWith(500);



        expect(res.json)
            .toHaveBeenCalled();


        expect(next)
            .not.toHaveBeenCalled();


    });



});