var request = require('request')
  , jsonstream = require('jsonstream')
  , headers = {'accept':'application/json'}
  , util = require('util')
  , events = require('events')
  ;

function FollowCouch (url, since) {
  var self = this
  if (url[url.length -1] !== '/') url += '/'
  self.url = url + '_changes?feed=continuous&heartbeat=10000&include_docs=true'
  self.since = since || 0
  self.init()
}
util.inherits(FollowCouch, events.EventEmitter)
FollowCouch.prototype.init = function () {
  var self = this

  if (self.resp) self.resp.pause()
  if (self.req) self.req.abort()

  self.req = request(self.url+'&since='+self.since, {headers:headers})
  self.req.on('response', function (resp) {
    if (resp.statusCode !== 200) return self.emit('error', new Error("Status code is not 200, "+resp.statusCode))
    self.resp = resp
    var json = jsonstream.parse()
    self.req.pipe(json)
    json.on('data', function (row) {
      self.since = row.seq
      self.emit('row', row)
      self.emit('doc', row.doc)
    })
    self.req.on('data', function () {
      self.kicktimeout()
    })
    resp.on('error', function () {
      self.init()
    })
    json.on('error', function (err) {
      self.init()
    })
    self.kicktimeout()
    self.req.removeListener('error', errorListener)
    self.req.on('error', function (err) {
      console.error('socket error, reconnecting')
      self.init()
    })
    self.req.on('end', function () {
      self.init()
    })
  })

  var errorListener = function (err) {self.emit('error', err)}
  self.req.on('error', errorListener)
}
FollowCouch.prototype.kicktimeout = function () {
  var self = this
  if (self.timeout) clearTimeout(self.timeout)
  self.timeout = setTimeout(function () {
    self.init()
  }, 30 * 1000)
}

module.exports = function createFollow (url, since) {return new FollowCouch(url, since)}