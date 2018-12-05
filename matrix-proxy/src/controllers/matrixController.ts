import {Route, Post, Body} from 'tsoa';
import {UserCredentials} from '../models/matrix';

@Route('matrix')
export class MatrixController {

    // connectionManager: ConnectionManager;

    constructor() {
        // this.connectionManager = ConnectionManager.getInstance();
    }

    @Post('connect')
    public async Connect(@Body() credentials: UserCredentials): Promise<any> {
        console.log('CONNECT:', credentials);
        return Promise.resolve();
        // const service = new MatrixService(this.connectionManager);
        // return await service.connect(credentials);
    }

    /*@Post('login')
    public async Login(@Body() credentials: UserCredentials): Promise<MatrixLogin> {
        const service = new MatrixService();
        return await service.login(credentials);
    }*/

}
