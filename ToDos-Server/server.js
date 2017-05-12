/**
 * Created by AdityaChugh on 2017-04-17.
 */

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server, {'transports': ['websocket', 'polling']});
var cors = require('cors');
var _ = require('lodash');
var Delta = require('quill-delta');
var util = require('util');

app.use(cors());

var db = {
  documents: {},
  userDocuments: {},
  clients: []
};

app.get('/', function (req, res) {
  // console.log('DB: ', db);
  console.log(util.inspect(db, {showHidden: false, depth: null}));
  res.send(db);
});

server.listen(3000, function () {
  console.log('App Running On Port 3000');
});

var getRandomColor = function() {
  return 'rgb(' +
    (Math.floor(Math.random()*56)+200) + ', ' +
    (Math.floor(Math.random()*56)+200) + ', ' +
    (Math.floor(Math.random()*56)+200) +
    ')';
};

io.on('connection', function (socket) {

  db.clients.push(socket.id);

  console.log('Client Connected! Connected Users: ', db.clients.length);
  socket.color = getRandomColor();

  socket.on("joinDocument", function(docName) {
    socket.join(docName);
    console.log("DocName: ", docName in db.documents);
    if (docName in db.documents) {
      db.documents[docName].clients.push(socket.id);
    } else {
      db.documents[docName] = {
        clients: [socket.id],
        selections: [],
        document: {delta: new Delta(), revisionNumber: 0, lowestRevision: 0},
        clientRevisions: {}
      };
    }
    db.userDocuments[socket.id] = docName;
    socket.emit("initialDocumentData", db.documents[docName]);
    socket.broadcast.to(docName).emit('usersChanged', db.documents[docName].clients.length);
  });

  var findLowestRevision = function() {
    var dict = db.documents[db.userDocuments[socket.id]].clientRevisions;
    var lowest = null;
    for (var key in dict) {
      if (!lowest) {
        lowest = dict[key];
      } else if (dict[key] < lowest) {
        lowest = dict[key]
      }
    }
    db.documents[db.userDocuments[socket.id]].document.lowestRevision = lowest;
  };

  socket.on("textChanged", function (revision) {
    if (revision.revisionNumber < db.documents[db.userDocuments[socket.id]].document.revisionNumber) {

    }
    db.documents[db.userDocuments[socket.id]].document = {delta: db.documents[db.userDocuments[socket.id]].document.delta.compose(revision.delta), revisionNumber: revision.revisionNumber};
    socket.broadcast.to(db.userDocuments[socket.id]).emit("textChanged", {
      revision: revision,
      socketId: socket.id
    });
  });

  socket.on("acknowledgeRevision", function (revisionNumber) {
    if (socket.id in db.documents[db.userDocuments[socket.id]].clientRevisions) {
      if (db.documents[db.userDocuments[socket.id]].clientRevisions[socket.id] > revisionNumber) {
        // TODO - handle revisions out of order
      } else {
        db.documents[db.userDocuments[socket.id]].clientRevisions[socket.id] = revisionNumber
      }
    } else {
      db.documents[db.userDocuments[socket.id]].clientRevisions[socket.id] = revisionNumber
    }
    findLowestRevision();
  });

  socket.on("selectionChanged", function (selection) {
    socket.broadcast.to(db.userDocuments[socket.id]).emit("selectionChanged", {
      selection: selection,
      socketId: socket.id,
      color: socket.color
    });
  });

  var removeFromDb = function() {
    _.remove(db.documents[db.userDocuments[socket.id]].clients, function (currentSocket) {
      return currentSocket === socket.id;
    });
    socket.broadcast.to(db.userDocuments[socket.id]).emit('usersChanged', db.documents[db.userDocuments[socket.id]].clients.length);
    db.userDocuments[socket.id] = null;
  };

  socket.on("leaveDocument", function () {
    removeFromDb();
  });

  socket.on("disconnect", function () {
    _.remove(db.clients, function (currentSocket) {
      return currentSocket === socket.id;
    });
    console.log('Client Disconnected! Connected Users: ', db.clients.length);
    if (socket.id in db.userDocuments) {
      removeFromDb();
    }
  });

});