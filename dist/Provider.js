import { EventEmitter } from "events";
export class Provider extends EventEmitter {
    port;
    constructor(port) {
        super();
        this.port = port;
    }
}
