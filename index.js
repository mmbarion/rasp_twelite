const serialport = require('serialport');
const request = require('request');
const IoT = require('aws-iot-device-sdk');
const topic = "sensor";
const certDir = '/home/pi/awsCerts';

const clientId = 'houseA';

const device = IoT.device({
	keyPath: certDir + '/0a67270e5d-private.pem.key',
	certPath: certDir + '/0a67270e5d-certificate.pem.crt',
	caPath: certDir + '/root-CA.crt',
	clientId: clientId,
	region: 'ap-northeast-1'
});

const portName = '/dev/ttyUSB0';
const sp = new serialport.SerialPort(portName,{
	baudRate:115200,
	dataBits:8,
	parity:'none',
	stopBits:1,
	flowControl:false,
	parser:serialport.parsers.readline("\r\n")
});

const temp_buffer = [];
const humd_buffer = [];
const intervalTime = 20000;//ms

sp.on('open',function(){
	console.log('serial-open');
});

sp.on('close',function(){ console.log('serial-close'); });


var last = new Date();

device.on('connect',function(){
	console.log('aws IoT connected...');
	sp.on('data',function(input){
	//	var buffer = new Buffer(input,'utf8');
		var str = ""+input;
		if(str.indexOf("::ts") == -1){
		   var wk = str.split(":");
		   // console.log(wk);

		   var lqi = wk[3].split("=")[1];//受信電波品質
	       var id = wk[6].split("=")[1];
	       var vcc = wk[7].split("=")[1];//子機の電源電圧
	       var temp = wk[10].split("=")[1]/100;//温度
	       var humd = wk[11].split("=")[1]/100;//湿度

	       if(isNumber(temp)) temp_buffer.push(temp);
	       if(isNumber(humd)) humd_buffer.push(humd);

	       const now = new Date();
	       //設定した送信間隔を過ぎていた場合データをaws Iotに送信
	       if((now.getTime()) - (last.getTime()) > intervalTime){
	       		const temp_av = arrayAverage(temp_buffer);
	       		const humd_av = arrayAverage(humd_buffer);
	       		const payload = {
		       		houseId:'house99',
		       		datetime:convertDateLabel(),
		       		id:parseInt(id),
		       		lqi:parseInt(lqi),
		       		vcc:parseInt(vcc),
		       		temp:temp_av,
		       		humd:humd_av
		        };
		        console.log(payload);
		        device.publish(topic,JSON.stringify(payload));
		        console.log('published');
	       		last = now;
	       }
	       // device.publish(topic,JSON.stringify(payload));

		}
	});
});

device.on('message',function(topic,payload){
	// const data = JSON.parse(payload);
	// if(data.user != clientId) {
	// 	console.log(data.message,"<<<",data.user);
	// }
});

function convertDateLabel(){
	var date = new Date();
	var year = date.getFullYear();
	var month = (date.getMonth() + 1 < 10) ? '0'+(date.getMonth()+1) : date.getMonth()+1;
	var day = (date.getDate() < 10) ? '0'+date.getDate() : date.getDate();
	var hour = ( date.getHours()   < 10 ) ? '0' + date.getHours()   : date.getHours();
	var min  = ( date.getMinutes() < 10 ) ? '0' + date.getMinutes() : date.getMinutes();
	var sec = ( date.getSeconds() < 10 ) ? '0' + date.getSeconds() : date.getSeconds();

	return year+'/'+month+'/'+day+' '+hour+':'+min+':'+sec;
}

function isNumber(num){
	var pattern = /^([1-9]\d*|0)(\.\d+)?$/; //符号なし小数

	return pattern.test(num);
}

function arrayAverage(arr){
	var sum = 0,len = arr.length;
	for(var i = 0; i < len; i++){
		sum += arr[i];
	}
	sum /= len;
	sum *= 100;
	sum = Math.floor(sum);
	sum /= 100;
	return sum;
}