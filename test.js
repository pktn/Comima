require('./objectdump');


var dumpObj = function(o){
  var str = "";
  for(var i in o) {
    str = str + "\n" + i + "\t"+ o[i];
  }
  console.log('Method response for \'anAction\': ' + str)
}

var xmlrpc = require('xmlrpc');

// Waits briefly to give the XML-RPC server time to start up and start
// listening
setTimeout(function () {
  // Creates an XML-RPC client. Passes the host information on where to
  // make the XML-RPC calls.
  var client = xmlrpc.createClient({ host: 'localhost', port: 8080, path: '/?m=api&a=do_xmlrpc'})

  // Sends a method call to the XML-RPC server
  client.methodCall('001_get_c_member', [{target_c_member_id : 118078, my_c_member_id: 118078}], function (error, value) {
    // Results of the method response
    
    //console.log('Method response for \'anAction\': ' + objectdump(value))
    dumpObj(value)
  })

}, 1000)
