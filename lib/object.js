module.exports = EchoesObject;

function EchoesObject(component) {
    this.log_levels = {
        0: 'debug',
        1: 'info',
        2: 'warn',
        3: 'error',
    }
    this.component = component + '';
    this.log_entries = [];
}

EchoesObject.prototype.log = function(msg, level) {
    level = (typeof level != 'undefined' ? level : 1);

    if (! AppConfig.CONSOLE_LOG
        && typeof msg != 'string') {
        msg = JSON.stringify(msg);
    }

    if (level >= AppConfig.LOG_LEVEL) {
        var timestamp = new Date().toISOString();
        var entry = timestamp + ' - ' + (this.component ? this.component.toLowerCase() + ' - ' : '') + this.log_levels[level] + ': ' + msg;

        if (AppConfig.CONSOLE_LOG) {
            console.log(entry);
        } else {
            this.log_entries.push(entry);
        }
    }
}
