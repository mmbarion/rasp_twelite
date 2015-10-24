var serialport = require('serialport');
var request = require('request');
var config = require('config');

var configSensorAPI = config.get('sensor_api');
var lineno = 2;

var portName = '/dev/ttyUSB0';
var sp = new serialport.SerialPort(portName,{
	baudRate:115200,
	dataBits:8,
	parity:'none',
	stopBits:1,
	flowControl:false,
	parser:serialport.parsers.readline("\r\n")
});

sp.on('open',function(){
	console.log('open');
});

sp.on('close',function(){ console.log('close'); });

sp.on('data',function(input){
//	var buffer = new Buffer(input,'utf8');
	var str = ""+input;
	if(str.indexOf("::ts") == -1){
	   var wk = str.split(":");
	   console.log(wk);
                 var id = wk[6].split("=")[1];
                 var temp = wk[10].split("=")[1]/100;
                 var humd = wk[11].split("=")[1]/100;
        put_API(id,temp,humd);

	}
});

function put_API(id,temp,humd){
	var t_date = Math.floor( new Date().getTime() / 1000 ) ;
	var requestOptions = {
		url:configSensorAPI.Invoke,
		method:"POST",
		headers: {
			"x-api-key":configSensorAPI.APIKey,
			"content-type":"application/json"
		},
		body:JSON.stringify({"lineid":id,"lineno":lineno,"t_date":t_date,"temp":temp,"humd":humd})
	}
	request(requestOptions,function optionalCallback(err,httpResponse,body){
		if(err){
			return console.log(err);
		}
		console.log('successfull: ',body);
	});
}