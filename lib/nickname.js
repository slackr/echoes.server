module.exports = Nickname;

function Nickname(name, id) {
    this.name = name;
    this.id = id;
    this.pubkey = null;
    this.channels = [];
    this.sane = false;

    this.sanity_check();
};

Nickname.prototype.sanity_check = function() {
    this.sane = false;

    if (typeof this.name == 'string'
        || this.name instanceof String) {

        this.name = this.name.replace(/[^a-z0-9\-\_]+/gi,'');
        if (this.name.length > 0) {
            this.sane = true;
        }
    }
}
