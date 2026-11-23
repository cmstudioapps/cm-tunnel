import { EventEmitter } from "events";
export class Provider extends EventEmitter {
    options;
    port;
    constructor(options) {
        super();
        this.options = options;
        this.port = options.port;
    }
}
