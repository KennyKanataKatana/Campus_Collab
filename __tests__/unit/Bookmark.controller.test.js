const controller = require('../../src/controllers/BookMarkController');
const model = require('../../src/models/BookMarkModel');

jest.mock('../../src/models/BookMarkModel');


describe('BookMarkController Unit Tests', () => {

    let req;
    let res;


    beforeEach(() => {

        req = {
            params: {
                post_id: 1
            }
        };


        res = {
            locals: {
                userId: 1
            },
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };


        jest.clearAllMocks();

    });



    // =====================================================
    // readBookMarksByUserId()
    // =====================================================

    describe('readBookMarksByUserId', () => {


        test('should return bookmarks successfully', () => {


            model.readBookMarksByUserId.mockImplementation(
                (data, callback) => {

                    callback(null, {
                        rows: [
                            {
                                id: 1,
                                post_id: 5
                            }
                        ]
                    });

                }
            );


            controller.readBookMarksByUserId(req, res);


            expect(res.status)
                .toHaveBeenCalledWith(200);


            expect(res.json)
                .toHaveBeenCalledWith([
                    {
                        id: 1,
                        post_id: 5
                    }
                ]);

        });





        test('should return 500 when reading bookmarks fails', () => {


            model.readBookMarksByUserId.mockImplementation(
                (data, callback) => {

                    callback(new Error());

                }
            );


            controller.readBookMarksByUserId(req, res);



            expect(res.status)
                .toHaveBeenCalledWith(500);


        });



    });








    // =====================================================
    // cancelBookMark()
    // =====================================================


    describe('cancelBookMark', () => {



        test('should cancel bookmark successfully', () => {


            model.cancelBookMark.mockImplementation(
                (data, callback) => {

                    callback(null, {
                        rowCount: 1
                    });

                }
            );



            controller.cancelBookMark(req,res);



            expect(res.status)
                .toHaveBeenCalledWith(200);



            expect(res.json)
                .toHaveBeenCalledWith({
                    message: 'Bookmark deleted successfully'
                });


        });






        test('should return 404 when bookmark does not exist', () => {


            model.cancelBookMark.mockImplementation(
                (data, callback) => {

                    callback(null, {
                        rowCount: 0
                    });

                }
            );



            controller.cancelBookMark(req,res);



            expect(res.status)
                .toHaveBeenCalledWith(404);



            expect(res.json)
                .toHaveBeenCalledWith({
                    message: 'Bookmark not found'
                });


        });








        test('should return 500 when cancelling bookmark fails', () => {


            model.cancelBookMark.mockImplementation(
                (data, callback) => {

                    callback(new Error());

                }
            );



            controller.cancelBookMark(req,res);



            expect(res.status)
                .toHaveBeenCalledWith(500);



        });



    });



});