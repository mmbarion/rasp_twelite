var serialport = require('serialport');
var request = require('request');
var config = require('config');
var mqtt = require('mqtt');

var configSensorAPI = config.get('sensor_api');
var mqttConfig = config.get('mqttBroker');
var client = mqtt.connect('ws://'+mqttConfig.url+':8080');//ブラウザ向け
// var client = mqtt.connect('mqtt://'+mqttConfig.url);

var lineid = 1;
var lineno = 1;

client.on('connect',function(err){
	if(err){
		console.log(err);
		return;
	}
	console.log('MQTTBroker_connected.')
	// client.subscribe('sensor/lineid');
	// client.publish('presence','Hello,MQTT');
});

client.on('message',function(topic,message) {
	console.log(message.toString());
	client.end();
});

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
	console.log('serial-open');
});

sp.on('close',function(){ console.log('serial-close'); });

sp.on('data',function(input){
//	var buffer = new Buffer(input,'utf8');
	var str = ""+input;
	if(str.indexOf("::ts") == -1){
	   var wk = str.split(":");
	   console.log(wk);

	   var lqi = wk[3].split("=")[1];//受信電波品質
       var id = wk[6].split("=")[1];
       var vcc = wk[7].split("=")[1];//子機の電源電圧
       var temp = wk[10].split("=")[1]/100;//温度
       var humd = wk[11].split("=")[1]/100;//湿度
       //put_API(id,temp,humd);
       publish_data(id,temp,humd,vcc,lqi);
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

//mqttでセンサーとTWELITEの情報を送信
function publish_data(id,temp,humd,vcc,lqi){
	var obj = {
		"id":id,
		"temp":temp,
		"humd":humd,
		"vcc":vcc,
		"lqi":lqi
	};
	client.publish('sensor/lineid'+lineid,JSON.stringify(obj));
}