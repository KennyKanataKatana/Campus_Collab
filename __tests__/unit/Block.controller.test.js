const controller = require('../../src/controllers/BlockController');
const model = require('../../src/models/BlockModel');

jest.mock('../../src/models/BlockModel');


describe('BlockController Unit Tests', () => {

    let req;
    let res;


    beforeEach(() => {

        req = {
            params: {
                id: 2,
                name: "alex"
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
    // readBlocksByUserId()
    // =====================================================

    describe('readBlocksByUserId', () => {


        test('should return blocked users successfully', () => {

            model.readBlocksByUserId.mockImplementation(
                (data, callback) => {
                    callback(null, {
                        rows: [
                            {
                                blocked_id: 2
                            }
                        ]
                    });
                }
            );


            controller.readBlocksByUserId(req, res);


            expect(res.status)
                .toHaveBeenCalledWith(200);


            expect(res.json)
                .toHaveBeenCalledWith([
                    {
                        blocked_id: 2
                    }
                ]);

        });



        test('should return 500 when model fails', () => {

            model.readBlocksByUserId.mockImplementation(
                (data, callback) => {
                    callback(new Error());
                }
            );


            controller.readBlocksByUserId(req, res);


            expect(res.status)
                .toHaveBeenCalledWith(500);

        });


    });





    // =====================================================
    // blockUser()
    // =====================================================

    describe('blockUser', () => {


        test('should block user successfully', () => {


            model.blockUser.mockImplementation(
                (data, callback) => {
                    callback(null);
                }
            );


            controller.blockUser(req,res);



            expect(res.status)
                .toHaveBeenCalledWith(201);


            expect(res.json)
                .toHaveBeenCalledWith({
                    message: 'User blocked successfully'
                });


        });




        test('should return 400 when blocked id missing', () => {


            req.params.id = undefined;


            controller.blockUser(req,res);


            expect(res.status)
                .toHaveBeenCalledWith(400);



        });





        test('should return 409 for duplicate block', () => {


            model.blockUser.mockImplementation(
                (data, callback)=>{
                    callback({
                        code:"23505"
                    });
                }
            );


            controller.blockUser(req,res);



            expect(res.status)
                .toHaveBeenCalledWith(409);


        });





        test('should return 400 when blocking yourself', () => {


            model.blockUser.mockImplementation(
                (data, callback)=>{
                    callback({
                        code:"23514"
                    });
                }
            );



            controller.blockUser(req,res);



            expect(res.status)
                .toHaveBeenCalledWith(400);


        });





        test('should return 500 for unknown error', () => {


            model.blockUser.mockImplementation(
                (data,callback)=>{
                    callback({
                        code:"99999"
                    });
                }
            );


            controller.blockUser(req,res);


            expect(res.status)
                .toHaveBeenCalledWith(500);


        });


    });






    // =====================================================
    // unblockUser()
    // =====================================================


    describe('unblockUser',()=>{


        test('should unblock successfully',()=>{


            model.unblockUser.mockImplementation(
                (data,callback)=>{
                    callback(null,{
                        rowCount:1
                    });
                }
            );


            controller.unblockUser(req,res);


            expect(res.status)
                .toHaveBeenCalledWith(200);


        });




        test('should return 404 when user not found',()=>{


            model.unblockUser.mockImplementation(
                (data,callback)=>{
                    callback(null,{
                        rowCount:0
                    });
                }
            );


            controller.unblockUser(req,res);


            expect(res.status)
                .toHaveBeenCalledWith(404);


        });




        test('should return 500 when unblock fails',()=>{


            model.unblockUser.mockImplementation(
                (data,callback)=>{
                    callback(new Error());
                }
            );


            controller.unblockUser(req,res);


            expect(res.status)
                .toHaveBeenCalledWith(500);


        });


    });







    // =====================================================
    // searchUsersToBlock()
    // =====================================================


    describe('searchUsersToBlock',()=>{


        test('should return searched users',()=>{


            model.searchUsersToBlock.mockImplementation(
                (data,callback)=>{
                    callback(null,{
                        rows:[
                            {
                                id:3
                            }
                        ]
                    });
                }
            );


            controller.searchUsersToBlock(req,res);


            expect(res.status)
                .toHaveBeenCalledWith(200);


        });





        test('should return 500 when search fails',()=>{


            model.searchUsersToBlock.mockImplementation(
                (data,callback)=>{
                    callback(new Error());
                }
            );


            controller.searchUsersToBlock(req,res);


            expect(res.status)
                .toHaveBeenCalledWith(500);


        });



    });


});