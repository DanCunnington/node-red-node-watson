/**
 * Copyright 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
  var cfenv = require('cfenv'), watson = require('watson-developer-cloud'), service = null,
    sUsername = null, sPassword = null;

  service = cfenv.getAppEnv().getServiceCreds(/conversation/i);

  if (service) {
    sUsername = service.username;
    sPassword = service.password;
  }

  RED.httpAdmin.get('/watson-conversation/vcap', function (req, res) {
    res.json(service ? {bound_service: true} : null);
  });


  function verifyPayload(node, msg) {
    if (!msg.payload) {
      this.status({fill:'red', shape:'ring', text:'missing payload'});
      node.error('Missing property: msg.payload', msg);
      return false;
    }
    return true;
  }

  function verifyInputs(node, msg, config) {
    if (!config.workspaceid && !msg.params.workspace_id) {
      node.error('Missing workspace_id. check node documentation.',msg);
      return false;
    }
    // workspaceid can be either configured in the node,
    // or sent into msg.params.workspace_id
    if (config.workspaceid && config.workspaceid) {
      node.workspaceid = config.workspaceid;
    }
    if (msg.params && msg.params.workspace_id) {
      node.workspaceid = msg.params.workspace_id;
    }
    // option context in JSON format
    if (msg.params && msg.params.context) {
      node.context = msg.params.context;
    }
    return true;
  }

  function verifyServiceCredentials(node, msg) {
    // If it is present the newly provided user entered key
    // takes precedence over the existing one.
    var userName = sUsername || node.credentials.username,
      passWord = sPassword || node.credentials.password;

    if (!userName || !passWord) {
      node.status({fill:'red', shape:'ring', text:'missing credentials'});
      node.error('Missing Watson Conversation API service credentials', msg);
      return false;
    }
    node.service = watson.conversation({
      username: userName,
      password: passWord,
      version: 'v1',
      version_date: '2016-07-11'
    });
    return true;
  }

  function processResponse(err, body, node, msg) {
    if (err != null && body == null) {
      node.status({fill:'red', shape:'ring',
        text:'call to watson conversation service failed'});
      node.error(err);
      return;
    }
    msg.payload = body;
    node.send(msg);
    node.status({});
  }

  function execute(params, node, msg) {
    node.status({fill:'blue', shape:'dot' , text:'Calling Conversation service ...'});
    params.workspace_id = node.workspaceid;
    params.input = {text:msg.payload};
    params.context = node.context;
    // call POST /message through SDK
    node.service.message(params, function(err, body) {
      processResponse(err,body,node,msg);
    });
  }

  // This is the Watson Conversation V1 (GA) Node
  function WatsonConversationV1Node (config) {
    var node = this, b = false;

    RED.nodes.createNode(this, config);

    node.on('input', function (msg) {
      var params = {};

      node.status({});

      b = verifyPayload(node, msg);
      if (!b) {
        return;
      }
      b = verifyInputs(node, msg, config);
      if (!b) {
        return;
      }
      b = verifyServiceCredentials(node, msg);
      if (!b) {
        return;
      }
      execute(params,node,msg);
    });
  }

  RED.nodes.registerType('watson-conversation-v1', WatsonConversationV1Node, {
    credentials: {
      username: {type:'text'},
      password: {type:'password'}
    }
  });


};
