import { STRINGS } from './cli-utils.js';
const MAX_LOG_LINES = 10;
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR = '\x1b[2J\x1b[H';
function stripAnsi(text) {
    return text
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}
function truncate(text, width) {
    if (text.length <= width)
        return text;
    return `${text.slice(0, Math.max(0, width - 1))}…`;
}
function modeLabel(plan, s) {
    if (plan.target)
        return s.dashboardModeTarget(plan.target);
    if (plan.mode === 'site')
        return s.dashboardModeSite;
    if (plan.mode === 'api')
        return s.dashboardModeApi;
    return s.dashboardModeBoth;
}
function publishLabel(plan, s) {
    if (plan.publish === 'quick')
        return s.dashboardPublishQuick;
    return s.dashboardPublishDomain(plan.domain ?? '?');
}
export class Dashboard {
    lang;
    plan;
    logs = [];
    partial = '';
    url = '';
    localPort;
    status = 'starting';
    renderTimer = null;
    enabled;
    color;
    constructor(lang, plan) {
        this.lang = lang;
        this.plan = plan;
        this.enabled = !!process.stdout.isTTY;
        this.color = this.enabled && !process.env.NO_COLOR;
    }
    get isEnabled() {
        return this.enabled;
    }
    push(chunk) {
        const text = stripAnsi(chunk).replace(/\r/g, '');
        this.partial += text;
        const lines = this.partial.split('\n');
        this.partial = lines.pop() ?? '';
        for (const line of lines) {
            if (line.trim())
                this.logs.push(line);
        }
        if (this.logs.length > MAX_LOG_LINES) {
            this.logs = this.logs.slice(-MAX_LOG_LINES);
        }
        if (this.enabled)
            this.scheduleRender();
    }
    scheduleRender() {
        if (this.renderTimer)
            return;
        this.renderTimer = setTimeout(() => {
            this.renderTimer = null;
            this.render();
        }, 100);
    }
    setUrl(url) {
        this.url = url;
        this.status = 'online';
        if (this.enabled)
            this.render();
    }
    setLocalPort(port) {
        this.localPort = port;
        if (this.enabled)
            this.scheduleRender();
    }
    start() {
        if (!this.enabled)
            return;
        process.stdout.write(HIDE_CURSOR);
        this.render();
    }
    stop() {
        if (this.renderTimer) {
            clearTimeout(this.renderTimer);
            this.renderTimer = null;
        }
        if (!this.enabled)
            return;
        this.status = 'stopped';
        this.render();
        process.stdout.write(`${SHOW_CURSOR}\n`);
    }
    paint(text, code) {
        return this.color ? `${code}${text}${RESET}` : text;
    }
    render() {
        if (!this.enabled)
            return;
        const s = STRINGS[this.lang];
        const width = Math.max(40, Math.min(process.stdout.columns || 100, 120));
        const line = (text) => truncate(text, width);
        const statusText = this.status === 'online'
            ? s.dashboardOnline
            : this.status === 'stopped'
                ? s.dashboardStopped
                : s.dashboardStarting;
        const statusColor = this.status === 'online'
            ? GREEN
            : this.status === 'stopped'
                ? RED
                : YELLOW;
        const output = [
            `${this.paint(s.dashboardTitle, BOLD)}  ${this.paint(`● ${statusText}`, statusColor)}`,
            '',
        ];
        if (this.url) {
            output.push(line(this.paint(s.dashboardUrl(this.url), BOLD)));
        }
        output.push(line(`Modo:  ${modeLabel(this.plan, s)}`));
        output.push(line(`Pub:   ${publishLabel(this.plan, s)}`));
        if (this.plan.target) {
            output.push(line(s.dashboardLocal(`http://localhost:${this.plan.target}`)));
        }
        else if (this.localPort) {
            output.push(line(s.dashboardLocal(`http://localhost:${this.localPort}`)));
        }
        else {
            output.push(line(s.dashboardAwaitingLocal));
        }
        output.push('');
        output.push(this.paint(s.dashboardLogs, DIM));
        if (this.logs.length === 0) {
            output.push(this.paint(`  ${s.dashboardWaitingLogs}`, DIM));
        }
        else {
            for (const log of this.logs) {
                output.push(this.paint(`  ${log}`, DIM));
            }
        }
        output.push('');
        output.push(this.paint(s.dashboardCtrlC, DIM));
        process.stdout.write(`${CLEAR}${output.join('\n')}\n`);
    }
}
