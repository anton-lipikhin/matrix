import * as dotenv from 'dotenv';
dotenv.config();

import * as bodyParser from 'body-parser';
import * as express from 'express';
// import * as ws from 'socket.io';
import * as methodOverride from 'method-override';
import { RegisterRoutes } from './routes';
 import { matrixService } from './services/matrixService';

const app = express();

app.use('/docs', express.static(__dirname + '/swagger-ui'));
app.use('/swagger.json', (req, res) => {
    res.sendFile(__dirname + '/swagger.json');
});
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3001 http://localhost:4200');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    res.header('Accept-Encoding', 'gzip,deflate');
    res.header('Transfer-Encoding', 'chunked');
    res.header('X-Frame-Options', 'SAMEORIGIN');
    res.header('X-Is-Logged-In', 'true');
    res.header('X-Transaction-ID', '126af233db39');
    res.header('Cache-Control', 'no-cache');
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());

RegisterRoutes(app);

// Init Matrix service before use
matrixService();

/* tslint:disable-next-line */
console.log('Starting server on port 3000...');
app.listen(process.env.SERVER_APP_PORT);

process.on('SIGINT', (e) => {
    console.info('SIGTERM signal received.', e);
    // TODO: Correctly disconnect from socket & ActiveMQ
    process.exit();
});

