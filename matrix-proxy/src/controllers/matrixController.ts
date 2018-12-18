import {Route, Get, Query} from 'tsoa';
import { matrixService } from '../services/matrixService';
// import {UserCredentials} from '../models/matrix';

@Route('matrix')
export class MatrixController {

    @Get('connect')
    public async Connect(@Query() phoneNumber: number): Promise<any> {
        console.log('CONNECT:', phoneNumber);
        let matrix = matrixService();
        return await matrix.getClientDetails(phoneNumber);
    }

    /*@Post('connect')
    public async Connect(@Body() credentials: UserCredentials): Promise<any> {
        console.log('CONNECT:', credentials);
        return Promise.resolve();
    }*/

}
