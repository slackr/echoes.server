module.exports = Nickname;

function Nickname(name, id) {
    EchoesObject.call(this, 'nick');

    this.name = name;
    this.id = id;
    this.pubkey = null;
    this.channels = [];
    this.sane = false;

    this.sanity_check();
};

Nickname.prototype = Object.create(EchoesObject.prototype);
Nickname.prototype.constructor = Nickname;

Nickname.prototype.sanity_check = function() {
    this.sane = false;

    if (typeof this.name == 'string'
        || this.name instanceof String) {

        this.name = this.name.replace(AppConfig.VALID_NICK_REGEX,'');
        if (this.name.length > 0) {
            this.sane = true;
            //this.log("nick '" + this.name + "' is valid", 0);
            return;
        }
    }
    this.log("nick '" + this.name + "' is invalid", 1);
}
