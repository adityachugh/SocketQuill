import {Component, OnInit} from '@angular/core';
import {Http} from "@angular/http";
import * as DiffMatchPatch from 'diff-match-patch';
import * as Delta from 'quill-delta';
import {LocalStorageService} from "./local-storage.service";

DiffMatchPatch.DIFF_DELETE = -1;
DiffMatchPatch.DIFF_INSERT = 1;
DiffMatchPatch.DIFF_EQUAL = 0;
const dmp = new DiffMatchPatch();

declare const io: any;
declare const Quill: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  get documentName() {
    return this.localStorage.get('documentName') || null;
  }
  set documentName(name) {
    this.localStorage.set('documentName', name);
  }
  loading = false;
  socket: any;
  baseURL: string = "http://localhost:3000";
  connectedUserCount = 1;
  editor: any;
  selections: any = {};
  revisionNumber: number = 0;

  constructor(private http: Http, private localStorage: LocalStorageService) {

    console.log('Quill: ', Quill);

    this.socket = io(this.baseURL);
    this.socket.on("initialDocumentData", data => this.initialData(data));
    this.socket.on("textChanged", data => this.textChanged(data));
    this.socket.on("usersChanged", count => this.usersChanged(count));
    this.socket.on("selectionChanged", data => this.selectionChanged(data));
  }

  ngOnInit() {
    this.setupQuill();
    this.setupRealtimeTransformations();
    if (this.documentName) {
      this.joinDocument();
    }
  }

  setupQuill() {
    let toolbarOptions = [
      ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
      ['blockquote', 'code-block'],

      [{'header': 1}, {'header': 2}],               // custom button values
      [{'list': 'ordered'}, {'list': 'bullet'}],
      [{'script': 'sub'}, {'script': 'super'}],      // superscript/subscript
      [{'indent': '-1'}, {'indent': '+1'}],          // outdent/indent
      [{'direction': 'rtl'}],                         // text direction

      [{'size': ['small', false, 'large', 'huge']}],  // custom dropdown
      [{'header': [1, 2, 3, 4, 5, 6, false]}],

      [{'color': []}, {'background': ['green', 'red', 'blue', 'white']}],          // dropdown with defaults from theme
      [{'font': []}],
      [{'align': []}],

      ['clean']                                         // remove formatting button
    ];

    this.editor = new Quill('#quill-editor', {
      modules: {
        toolbar: toolbarOptions
      },
      theme: 'snow'
    });
  }

  setupRealtimeTransformations() {
    this.editor.on('text-change', (delta: Delta, oldDelta, source) => {
      if (source == 'user') {
        console.log("User Typed: ", delta);
        for (const key in this.selections) {
          const selection = this.selections[key];
          console.log('Selection: ', selection);
          if (delta.ops[0].retain && delta.ops[0].retain > selection.index && selection.index + selection.length > delta.ops[0].retain) {
            console.log('Inside Selection');
            delete delta.ops[1].attributes.background;
            this.selections[key].length = selection.length + (typeof delta.ops[1].insert === 'string' ? delta.ops[1].insert.length : 1)
          } else if (delta.ops[0].retain && delta.ops[0].retain < selection.index) {
            this.selections[key].index = delta.transformPosition(selection.index)
          }
        }
        console.log("Document: ", this.editor.getContents());
        this.socket.emit("textChanged", {delta: delta, revisionNumber: this.revisionNumber});
        this.socket.emit('acknowledgeRevision', this.revisionNumber);
        this.revisionNumber++;
      }
    });

    this.editor.on('selection-change', (range, oldRange, source) => {
      console.log('Selection Range: ', range);
      if (range) {
        if (range.length == 0) {
          console.log('User cursor is on', range.index);
        } else {
          let text = this.editor.getText(range.index, range.length);
          console.log('User has highlighted', text);
        }
      } else {
        console.log('Cursor not in the editor');
      }
      this.socket.emit('selectionChanged', range);

    });
  }

  initialData(data) {
    this.loading = false;
    console.log('Data', data);
    this.editor.setContents(data.document.delta);
    this.revisionNumber = data.document.revisionNumber+1;
    this.connectedUserCount = data.clients.length;
  }

  joinDocument() {
    this.loading = true;
    this.socket.emit('joinDocument', this.documentName);
  }

  setDocumentName(name) {
    this.documentName = name;
    this.joinDocument();
  }

  changeDocument(event) {
    this.documentName = null;
    this.socket.emit('leaveDocument');
    this.editor.setContents(new Delta());
  }

  textChanged(data) {
    console.log("Data Text Cahnged: ", data);
    const delta = data.revision.delta;
    for (const key in this.selections) {
      const selection = this.selections[key];
      if (delta.ops[0].retain && delta.ops[0].retain > selection.index && selection.index + selection.length > delta.ops[0].retain) {
        console.log('Inside Selection');
        delta.ops[1].attributes.background = selection.color;
        this.selections[key].length = selection.length + (typeof delta.ops[1].insert === 'string' ? delta.ops[1].insert.length : 1)
      } else if (delta.ops[0].retain && delta.ops[0].retain < selection.index) {
        this.selections[key].index = delta.transformPosition(selection.index)
      }
    }
    this.editor.updateContents(delta);
    this.socket.emit('acknowledgeRevision', data.revision.revisionNumber);
    this.revisionNumber = data.revision.revisionNumber+1;
  }

  usersChanged(userCount) {
    this.connectedUserCount = userCount;
  }

  selectionChanged(data) {
    console.log("Selection: ", data);
    if (data.socketId in this.selections) {
      this.hideSelection(data.socketId);
    }
    data.selection.color = data.color;
    this.selections[data.socketId] = data.selection;
    if (data.selection) {
      if (data.selection.length === 0) {
        // TODO - Show Cursor
      } else {
        this.editor.updateContents(this.getBackgroundColorDelta(data.color, data.selection));
      }
    } else {
      // TODO - Hide Cursor
    }
  }

  hideSelection(selectionId) {
    const selection = selectionId in this.selections ? this.selections[selectionId] : null;
    if (!selection) {
      return;
    }
    delete this.selections[selectionId];
    this.editor.updateContents(this.getBackgroundColorDelta('white', selection));
  }

  getBackgroundColorDelta(color, selection): Delta {
    let delta = new Delta();
    if (selection.index !== 0) {
      delta = delta.retain(selection.index);
    }
    if (selection.length !== 0) {
      delta = delta.retain(selection.length, {background: color});
    }
    return delta;
  }
}
