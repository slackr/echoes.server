module.exports = Nickname;

function Nickname(name, id) {
    this.name = name.replace(/[^a-z0-9\-\_]+/gi,'');
    this.id = id;
    this.pubkey = null;
    this.channels = [];
};
