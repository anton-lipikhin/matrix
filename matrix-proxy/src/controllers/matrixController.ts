import * as express from 'express';
import {Route, Get, Request} from 'tsoa';
import { matrixService } from '../services/matrixService';
import { log } from '../api/log';
import {HandlerErrorService} from '../services/handleErrorService';
// import {UserCredentials} from '../models/matrix';

@Route('matrix')
export class MatrixController {

    requiredParams = ['phoneNumber'];

    @Get('connect')
    public async Connect(@Request() request: express.Request): Promise<any> {
        log.debug('REQUEST [MatrixController::Ctrl:Connect]: Debug', {request: request.originalUrl, method: 'GET'});
        let errorHandler = new HandlerErrorService(request);
        let error = errorHandler.validateQuery(this.requiredParams);
        if (error) {
            log.warn('QUERY [MatrixController::Ctrl:Connect]: Warning', {response: error, method: 'GET', code: 400});
            return error;
        }
        let matrix = matrixService();
        let response = await matrix.getClientDetails(request.query.phoneNumber);
        log.debug('RESPONSE [Reports::Service:getSale]: Debug', {response: response, method: 'GET'});
        return response;
    }

    /*@Post('connect')
    public async Connect(@Body() credentials: UserCredentials): Promise<any> {
        console.log('CONNECT:', credentials);
        return Promise.resolve();
    }*/

}
