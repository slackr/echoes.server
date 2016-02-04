module.exports = EchoesObject;

function EchoesObject(component) {
    this.log_levels = {
        0: 'debug',
        1: 'info',
        2: 'warn',
        3: 'error',
    }
    this.component = component + '';

    this.winston = require('winston');

    var path = require('path');
    var app_dir = path.dirname(require.main.filename);
    this.log_file_name = path.join(app_dir, 'log', AppConfig.LOG_FILE_NAME);

    this.logger = new this.winston.Logger({
        level: this.log_levels[AppConfig.LOG_LEVEL],
        transports: [
            new (this.winston.transports.Console)({
                handleExceptions: true,
                humanReadableUnhandledException: true
            }),
            new (this.winston.transports.File)({
                filename: this.log_file_name,
                json: false,
                handleExceptions: true,
                humanReadableUnhandledException: true
            })
        ]
    });
}

EchoesObject.prototype.log = function(msg, level) {
    level = (typeof level != 'undefined' ? level : 1);

    this.logger.log(this.log_levels[AppConfig.LOG_LEVEL], (this.component ? this.component.toLowerCase() : ''), '- ' + level + ' -', msg);
}
