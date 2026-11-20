const controller = require('../../src/controllers/PostHistoryController');
const model = require('../../src/models/PostHistoryModel');

jest.mock('../../src/models/PostHistoryModel');


describe('PostHistoryController Unit Tests', () => {

    let req;
    let res;


    beforeEach(() => {

        req = {
            params: {
                history_id: 1
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
    // readPostHistoryByUser()
    // =====================================================

    describe('readPostHistoryByUser', () => {


        test('should return post history successfully', () => {


            model.readPostHistoryByUser.mockImplementation(
                (data, callback) => {

                    callback(null, {
                        rows: [
                            {
                                history_id: 1,
                                post_id: 5
                            }
                        ]
                    });

                }
            );



            controller.readPostHistoryByUser(req, res);



            expect(res.status)
                .toHaveBeenCalledWith(200);



            expect(res.json)
                .toHaveBeenCalledWith([
                    {
                        history_id: 1,
                        post_id: 5
                    }
                ]);

        });






        test('should return 500 when reading post history fails', () => {


            model.readPostHistoryByUser.mockImplementation(
                (data, callback) => {

                    callback(new Error());

                }
            );



            controller.readPostHistoryByUser(req, res);



            expect(res.status)
                .toHaveBeenCalledWith(500);


        });



    });








    // =====================================================
    // deletePostHistory()
    // =====================================================

    describe('deletePostHistory', () => {



        test('should delete history successfully', () => {


            model.deletePostHistory.mockImplementation(
                (data, callback) => {

                    callback(null, {
                        rowCount: 1,
                        rows: [
                            {
                                history_id: 1
                            }
                        ]
                    });

                }
            );



            controller.deletePostHistory(req, res);



            expect(res.status)
                .toHaveBeenCalledWith(200);



            expect(res.json)
                .toHaveBeenCalledWith({

                    message: 'History deleted successfully',

                    deletedHistory: {
                        history_id: 1
                    }

                });


        });








        test('should return 404 when history record does not exist', () => {


            model.deletePostHistory.mockImplementation(
                (data, callback) => {

                    callback(null, {
                        rowCount: 0,
                        rows: []
                    });

                }
            );



            controller.deletePostHistory(req,res);



            expect(res.status)
                .toHaveBeenCalledWith(404);



            expect(res.json)
                .toHaveBeenCalledWith({

                    error: 'History record not found'

                });


        });








        test('should return 500 when deleting history fails', () => {


            model.deletePostHistory.mockImplementation(
                (data, callback) => {

                    callback(new Error());

                }
            );



            controller.deletePostHistory(req,res);



            expect(res.status)
                .toHaveBeenCalledWith(500);



        });



    });



});