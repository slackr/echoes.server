/**
 * Echoes Server
 *
 * @author  Adrian@Slacknet
 * @license http://www.gnu.org/licenses/gpl-3.0.txt GPLv3
 */

module.exports = Channel;

function Channel(name) {
    EchoesObject.call(this, 'chan');

    this.name = name;
    this.members = {};
    this.sane = false;

    this.sanity_check();
};

Channel.prototype = Object.create(EchoesObject.prototype);
Channel.prototype.constructor = Channel;

Channel.prototype.sanity_check = function() {
    this.sane = false;

    if (typeof this.name == 'string'
        || this.name instanceof String) {

        this.name = '#' + this.name.replace(AppConfig.VALID_CHAN_REGEX,'');
        this.sane = true;
        this.log("chan name: '" + this.name + "' is valid", 0);
        return;
    }

    this.log("chan '" + this.name + "' is invalid", 1);
}

Channel.prototype.join = function(nick) {
    this.members[nick.name] = nick;
    this.log("nick '" + nick.name + "' joined '" + this.name + "'", 0);
};

Channel.prototype.part = function(nick) {
    if (typeof this.members[nick.name] != 'undefined') {
        delete this.members[nick.name];
        this.log("nick '" + nick.name + "' parted '" + this.name, 0);
        return;
    }
    this.log("nick '" + nick.name + "' is not in '" + this.name, 0);
};
