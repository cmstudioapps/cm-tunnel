import ngrok from '@ngrok/ngrok';
import { Provider, ProviderOptions, TunnelResult } from '../Provider.js';

export default class NgrokProvider extends Provider {
  private url: string | null = null;
  private listener: ngrok.Listener | null = null;

  constructor(options: ProviderOptions) {
    super(options);
  }

  start(): Promise<TunnelResult> {
    return new Promise(async (resolve, reject) => {
      try {
        if (this.options.authtoken) {
          ngrok.authtoken(this.options.authtoken);
        }

        this.listener = await ngrok.forward({
          addr: this.port,
          authtoken: this.options.authtoken,
          // `domain` é o nome correto no SDK (pode ser ngrok.app ou domínio
          // customizado já registrado). `subdomain` está marcado como unused.
          domain: this.options.domain,
        });

        this.url = this.listener.url() || null;

        if (!this.url) {
          return reject(new Error('Falha ao obter URL do Ngrok.'));
        }

        this.emit('ready', this.url);

        resolve({
          provider: 'ngrok',
          url: this.url,
          port: this.port,
          stop: this.stop.bind(this),
          process: this.listener,
        });
      } catch (err: any) {
        reject(new Error(`Falha ao iniciar o túnel Ngrok: ${err.message}`));
      }
    });
  }

  stop() {
    if (this.listener) {
      this.listener.close().then(() => {
        this.emit('close');
      }).catch((err) => {
        this.emit('error', err);
      });
      this.listener = null;
    }
  }
}
