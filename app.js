/*
 *  ObservationDevice Ver.
 *  2016/09/11
 *  野村試験栽培版
 */
var config = require('./config');
var lineid = config.line,
      lineno = config.lineno;
console.log('LINE: '+lineid+':'+lineno);

//設定情報の初期値
//リレー１
var setData = [];
setData['temp'] = {
   top_r:0,
   bot_r:0,
   top_r_o:0,
   bot_r_o:0,
   now_p:0,
   start_date:0,
   end_date:0,
   vent_value:0,
   vent_flg:0,
   active_min_time:0,
   interval_time:0,
   danger_top_point:0,
   danger_bot_point:0,
   auto_control:0
};
//リレー２
setData['humd']= {
   top_r:0,
   bot_r:0,
   top_r_o:0,
   bot_r_o:0,
   now_p:0,
   start_date:0,
   end_date:0,
   vent_value:0,
   vent_flg:0,
   active_min_time:0,
   interval_time:0,
   danger_top_point:0,
   danger_bot_point:0,
   auto_control:0
};

//リレー3
setData['co2'] = {
   top_r:0,
   bot_r:0,
   top_r_o:0,
   bot_r_o:0,
   now_p:0,
   start_date:0,
   end_date:0,
   vent_value:0,
   vent_flg:0,
   active_min_time:0,
   interval_time:0,
   danger_top_point:0,
   danger_bot_point:0,
   auto_control:0
};

//登録スケジュールの有無
var vf_schedules = {
    temp:0,
    humd:0,
    co2:0
};

var set_flg = false;

var relayNum = setData.length;

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

var app = express();
var server = http.createServer(app);
// var io = require('socket.io');
// var skt = io.listen(server);
// skt.set('log level',1);

//CO2センサー使用準備
var serialport = require('serialport').SerialPort,
      portName = '/dev/ttyAMA0';
var sp = new serialport(portName,{
    baudRate:9600,
    dataBits:8,
    parity:'none',
    stopBits:1,
    flowControl:false
});

sp.on('close', function (err) { console.log('port closed'); });
sp.on('error', function (err) { console.error("error", err); });


// ***** 20160911 *****
// {
//   "host": "a3n2aatncelr7k.iot.ap-northeast-1.amazonaws.com",
//   "port": 8883,
//   "clientId": "ObDevice001",
//   "thingName": "ObDevice001",
//   "caCert": "root-CA.crt",
//   "clientCert": "21ecbd25e9-certificate.pem.crt",
//   "privateKey": "21ecbd25e9-private.pem.key"
// }

var request = require('request');
var IoT = require('aws-iot-device-sdk');
var topic = "sensor";
var certDir = '/home/pi/awsCerts';
var clientId = 'line'+lineid+lineno;

var device = IoT.device({
  keyPath: certDir + '/private.pem.key',
  certPath: certDir + '/certificate.pem.crt',
  caPath: certDir + '/root-CA.crt',
  clientId: "ObDevice001",
  region: 'ap-northeast-1'
});

device.on('connect',function(){
  console.log('aws IoT connected...');
  device.subscribe('line'+lineid+':'+lineno);
});

device.on('message',function(topic,payload){
  const data = JSON.parse(payload);
  if(data.user != clientId) {
   console.log(data.message,"<<<",data.user);
  }
});
// ********************

//var db_mongo = require('./models/database_mongo');
var chksensor = require('./models/checkSensor');
var devicecontrol = require('./models/deviceControl');
var deviceCtrl = require('./models/deviceControl');
var rdsAccess = require('./models/rdsAccess');
var sendMail = require('./models/sendMailSes');
var async = require('async');
//var localredis = require('redis').createClient(6379,'127.0.0.1');
//Redisから設定情報を引き出す
var obj;
var t_date = parseInt((new Date)/1000);
var remaining_time = {
   temp:{
       min:0,
       interval:0,
       min_flg:0,
       interval_flg:0,
       min_time:0,
       interval_time:0,
       change_flg:0
   },
   humd:{
       min:0,
       interval:0,
       min_flg:0,
       interval_flg:0,
       min_time:0,
       interval_time:0,
       change_flg:0
   },
   co2:{
       min:0,
       interval:0,
       min_flg:0,
       interval_flg:0,
       min_time:0,
       interval_time:0,
       change_flg:0
   }
};

  async.series([
      function(cb){
                rdsAccess.readSetting('temp',t_date,function(err,rs){
                    if(!err){
                        for(var x in rs[0]){
                            //存在するキーなら値を格納
                            if(x in setData['temp']){
                                setData['temp'][x] = rs[0][x];
                            }
                        }
                    }
                    remaining_time.temp.min = setData['temp'].active_min_time > 0 ? setData['temp'].active_min_time : 0;
                    remaining_time.temp.interval = setData['temp'].interval_time > 0 ? setData['temp'].interval_time : 0;
                    cb(null,'temp');
                });
      },
      function(cb){
                rdsAccess.readSetting('humd',t_date,function(err,rs){
                    if(!err){
                        for(var x in rs[0]){
                            //存在するキーなら値を格納
                            if(x in setData['humd']){
                                setData['humd'][x] = rs[0][x];
                            }
                        }
                    }
                    remaining_time.humd.min = setData['humd'].active_min_time > 0 ? setData['humd'].active_min_time : 0;
                    remaining_time.humd.interval = setData['humd'].interval_time > 0 ? setData['humd'].interval_time : 0;
                    cb(null,'humd');
                });
      },
      function(cb){
                rdsAccess.readSetting('co2',t_date,function(err,rs){
                    if(!err){
                        for(var x in rs[0]){
                            //存在するキーなら値を格納
                            if(x in setData['co2']){
                                setData['co2'][x] = rs[0][x];
                            }
                        }
                    }
                    remaining_time.co2.min = setData['co2'].active_min_time > 0 ? setData['co2'].active_min_time : 0;
                    remaining_time.co2.interval = setData['co2'].interval_time > 0 ? setData['co2'].interval_time : 0;
                    cb(null,'co2');
                });
      }
  ],function(err,result){
      console.log('all done.');
      console.log(result);
      set_flg = true;
  });

//GPIOpinの初期化
deviceCtrl.init();

var cronJob = require('cron').CronJob;
var checkTime = "*/1  * * * *";//1s
var saveTime = "*/10 * * * *";//１０分
var gPoints = {};//前回のセンサー値保存用
gPoints.celsius = 0;
gPoints.humidity = 0;
gPoints.ventilation = 0;
gPoints.co2 = 0;

sp.on('open', function () {
    console.log('serial port opened...');
    //ゼロ校正（必要なら実行する）
    //sp.write('G\r\n',function(err,results){});
    //ポーリングモードにセット
    sp.write('K 2\r\n',function(err, results){});
});
//Z\r\nコマンドの返り値をセットする
sp.on('data',function(data){
     console.log('serialData on.');
     var res = parseFloat(data.toString('ascii', 2, data.length));
     //console.log(res);
     gPoints.co2 = res;
});

//var request = require('request');

//定期的に処理を実行する
var pubparams = {},insertParams;
var checkjob = new cronJob({
    cronTime:checkTime,
    onTick:function() {
        console.log('onTick');
        task_job();
    },
    onComplete:function() {
        console.log('onComplete');
    },
    start:false,
    timeZone:"Asia/Tokyo"
});
checkjob.start();

//スケジュール読込→リレー切り替え→センサー情報プッシュ＆保存
function task_job(){
    console.log('task_job');
    if(set_flg){//設定情報の読み込みが終わってなかったら飛ばす
                sp.write('Z\r\n',function(err, results){
                    if(err){
                        sendMail.mailCommandSend({text:'Co2 Sensor Error..',
                                                                   subject:'observationDevice: '+lineid+':'+lineno,
                                                                   toaddress:'vitaapplication@gmail.com'});
                    }
                });
                chksensor.getPoints(function(err,params,stderr){
                    var chkdate = parseInt((new Date)/1000);
                    var insertDate = chkdate+32400;
                    if(!err){
                        async.series([
                            function(callback){
                                    gPoints.celsius = params.celsius;
                                    gPoints.humidity = params.humidity;
                                    setData['temp']['now_p'] = gPoints.celsius;//温度の現在値
                                    setData['humd']['now_p'] = gPoints.humidity;//湿度の現在値
                                    setData['co2']['now_p'] = gPoints.co2;//CO2の現在値
                                   // console.log(gPoints);
                                        async.series([
                                            function(cb){
                                                      rdsAccess.readSetting('temp',chkdate,function(err,rs,change_flg){
                                                          if(!err && rs.length === 0){//ループ中にスケジュールがなくなったらオールリセット
                                                              all_reset('temp');
                                                          } else if(!err &&( change_flg === 1)){//change_flgが1なら設定を更新する
                                                              rdsAccess.scheduleCheckOut([rs[0].start_date,rs[0].end_date],'temp');//変更チェック
                                                              for(var x in rs[0]){
                                                                  //存在するキーなら値を格納
                                                                  if(x in setData['temp']){
                                                                      setData['temp'][x] = rs[0][x];
                                                                  }
                                                              }
                                                              remaining_time.temp.min = setData['temp'].active_min_time > 0 ? setData['temp'].active_min_time : 0;
                                                              remaining_time.temp.interval = setData['temp'].interval_time > 0 ? setData['temp'].interval_time : 0;
                                                          }
                                                          cb(null,'temp');
                                                      });
                                            },
                                            function(cb){
                                                      rdsAccess.readSetting('humd',chkdate,function(err,rs,change_flg){
                                                          if(!err && rs.length === 0){//ループ中にスケジュールがなくなったらオールリセット
                                                              all_reset('humd');
                                                          } else if(!err &&( change_flg === 1)){
                                                              rdsAccess.scheduleCheckOut([rs[0].start_date,rs[0].end_date],'humd');//変更チェック
                                                              for(var x in rs[0]){
                                                                  //存在するキーなら値を格納
                                                                  if(x in setData['humd']){
                                                                      setData['humd'][x] = rs[0][x];
                                                                  }
                                                              }
                                                              remaining_time.humd.min = setData['humd'].active_min_time > 0 ? setData['humd'].active_min_time : 0;
                                                              remaining_time.humd.interval = setData['humd'].interval_time > 0 ? setData['humd'].interval_time : 0;
                                                          }
                                                          cb(null,'humd');
                                                      });
                                            },
                                            function(cb){
                                                      rdsAccess.readSetting('co2',chkdate,function(err,rs,change_flg){
                                                          if(!err && rs.length === 0){//ループ中にスケジュールがなくなったらオールリセット
                                                              all_reset('co2');
                                                          } else if(!err &&( change_flg === 1)){
                                                              rdsAccess.scheduleCheckOut([rs[0].start_date,rs[0].end_date],'co2');//変更チェック
                                                              for(var x in rs[0]){
                                                                  //存在するキーなら値を格納
                                                                  if(x in setData['co2']){
                                                                      setData['co2'][x] = rs[0][x];
                                                                  }
                                                              }
                                                              remaining_time.co2.min = setData['co2'].active_min_time > 0 ? setData['co2'].active_min_time : 0;
                                                              remaining_time.co2.interval = setData['co2'].interval_time > 0 ? setData['co2'].interval_time : 0;
                                                          }
                                                          cb(null,'co2');
                                                      });
                                            }
                                        ],function(err,result){
                                            console.log('all done.');
                                            console.log(result);
                                            set_flg = true;
                                            callback(null,'setting update.');
                                        });
                            },
                             function(callback){
                                    //現在の情報から各機器の状態を切り替える
                                 async.series([
                                    function(cb){
                                        //危険値範囲内かチェック
                                        var topd = parseFloat(setData['temp'].top_r)+parseFloat(setData['temp'].danger_top_point);
                                        var botd = parseFloat(setData['temp'].bot_r)-parseFloat(setData['temp'].danger_bot_point);
                                         if((gPoints.celsius >= topd && setData['temp'].top_r != topd) || (gPoints.celsius <= botd && setData['temp'].bot_r != botd)){
                                                    devicecontrol.off_device('temp',function(){});
                                                    var num = 'observationDevice: '+lineid+':'+lineno;
                                                    sendMail.mailCommandSend({text:'[danger][temp] MAX RANGE OVER.'+num,
                                                                                              subject:num,
                                                                                              toaddress:'vitaapplication@gmail.com'});
                                         }
                                        //設定スケジュールの範囲内なら実行
                                        if((setData['temp'].start_date <= chkdate) && (setData['temp'].end_date >= chkdate)){
                                                vf_schedules["temp"] = 1;
                                                devicecontrol.checkDevice(setData['temp'],'temp',{lineid:lineid,lineno:lineno},remaining_time,function(){ cb(null,'check temp.'); });
                                        } else {
                                            vf_schedules["temp"] = 0;
                                            cb(null,'check temp. no schedule');
                                        }
                                    },
                                    function(cb){
                                            //危険値範囲内かチェック
                                            var topd = parseFloat(setData['humd'].top_r)+parseFloat(setData['humd'].danger_top_point);
                                            var botd = parseFloat(setData['humd'].bot_r)-parseFloat(setData['humd'].danger_bot_point);
                                            if((gPoints.humidity >= topd && setData['humd'].top_r != topd) || (gPoints.humidity <= botd && setData['humd'].bot_r != botd)){
                                                    devicecontrol.off_device('humd',function(){ });
                                                    var num = 'observationDevice: '+lineid+':'+lineno;
                                                    sendMail.mailCommandSend({text:'[danger][humidity] MAX RANGE OVER.'+num,
                                                                                              subject:num,
                                                                                              toaddress:'vitaapplication@gmail.com'});
                                            }
                                        if((setData['humd'].start_date <= chkdate) && (setData['humd'].end_date >= chkdate)){
                                               vf_schedules["humd"] = 1;
                                               devicecontrol.checkDevice(setData['humd'],'humd',{lineid:lineid,lineno:lineno},remaining_time,function(){ cb(null,'check humd.'); });
                                        } else {
                                            vf_schedules["humd"] = 0;
                                            cb(null,'check humd. no schedule');
                                        }
                                    },
                                    function(cb){
                                            //危険値範囲内かチェック
                                            var topd = parseFloat(setData['co2'].top_r)+parseFloat(setData['co2'].danger_top_point);
                                            var botd = parseFloat(setData['co2'].bot_r)-parseFloat(setData['co2'].danger_bot_point);
                                            if((gPoints.co2 >= topd && setData['co2'].top_r != topd) || (gPoints.co2 <= botd && setData['co2'].bot_r != botd)){
                                                    devicecontrol.off_device('co2',function(){});
                                                    var num = 'observationDevice: '+lineid+':'+lineno;
                                                    sendMail.mailCommandSend({text:'[danger][co2] MAX RANGE OVER.'+num,
                                                                                              subject:num,
                                                                                              toaddress:'vitaapplication@gmail.com'});
                                            }
                                        if((setData['co2'].start_date <= chkdate) && (setData['co2'].end_date >= chkdate)){
                                               vf_schedules["co2"] = 1;
                                               devicecontrol.checkDevice(setData['co2'],'co2',{lineid:lineid,lineno:lineno},remaining_time,function(){ cb(null,'check co2.'); });
                                        } else {
                                            vf_schedules["co2"] = 0;
                                            cb(null,'check co2. no schedule');
                                        }
                                    }],function(err, result){
                                        console.log(result);
                                        callback(null,'cron:2');
                                    });
                             }
                         ],function(err, result){
                             //console.log(setData);
                             rdsAccess.readgpio(function(err,results){
                                 console.log('***** readgpio *****');
                                 pubparams.lineid=lineid,
                                 pubparams.lineno=lineno,
                                 pubparams.t_date=chkdate,
                                 pubparams.celsius = {
                                     now_p:gPoints.celsius,
                                     top_range:setData['temp'].top_r,
                                     bottom_range:setData['temp'].bot_r,
                                     vent_value:setData['temp'].vent_value,
                                     vent_flg:setData['temp'].vent_flg,
                                     active_min_time:setData['temp'].active_min_time,
                                     interval:setData['temp'].interval_time,
                                     danger_top_point:setData['temp'].danger_top_point,
                                     danger_bot_point:setData['temp'].danger_bot_point,
                                     auto_control:setData['temp'].auto_control
                                 },
                                 pubparams.humidity = {
                                     now_p:gPoints.humidity,
                                     top_range:setData['humd'].top_r,
                                     bottom_range:setData['humd'].bot_r,
                                     vent_value:setData['humd'].vent_value,
                                     vent_flg:setData['humd'].vent_flg,
                                     active_min_time:setData['humd'].active_min_time,
                                     interval:setData['humd'].interval_time,
                                     danger_top_point:setData['humd'].danger_top_point,
                                     danger_bot_point:setData['humd'].danger_bot_point,
                                     auto_control:setData['humd'].auto_control
                                 },
                                 pubparams.co2 = {
                                     now_p:gPoints.co2,
                                     top_range:setData['co2'].top_r,
                                     bottom_range:setData['co2'].bot_r,
                                     vent_value:setData['co2'].vent_value,
                                     vent_flg:setData['co2'].vent_flg,
                                     active_min_time:setData['co2'].active_min_time,
                                     interval:setData['co2'].interval_time,
                                     danger_top_point:setData['co2'].danger_top_point,
                                     danger_bot_point:setData['co2'].danger_bot_point,
                                     auto_control:setData['co2'].auto_control
                                 },
                                 pubparams.ventilation = {

                                 };
                                 if((results.length !== 0) || (!err)){
                                     pubparams.celsius.relay= results[0].status === 'OFF' ? 0 : 1;
                                     pubparams.humidity.relay= results[1].status === 'OFF' ? 0 : 1;
                                     pubparams.ventilation.relay= results[2].status === 'OFF' ? 0 : 1;
                                     pubparams.co2.relay= results[3].status === 'OFF' ? 0 : 1;
                                 } else {
                                     pubparams.celsius.relay=0;
                                     pubparams.humidity.relay=0;
                                     pubparams.ventilation.relay=0;
                                     pubparams.co2.relay=0;
                                 }
                                 console.log(pubparams);
                                 //redisサーバーにセンサー値をセット&publish

                                 //***** 20160911 ***** chksensor.publishAndSetRedis(pubparams);
                                 //AWS IOTに置き換える
                                 publishAWSIOT(pubparams)
                                 // insertParams = [
                                 //     lineid,
                                 //     lineno,
                                 //     chkdate,
                                 //     gPoints.celsius,
                                 //     gPoints.humidity,
                                 //     0,
                                 //     gPoints.co2,
                                 //     results[0].status === 'OFF' ? 0 : 1,
                                 //     results[1].status === 'OFF' ? 0 : 1,
                                 //     results[2].status === 'OFF' ? 0 : 1,
                                 //     results[3].status === 'OFF' ? 0 : 1,
                                 //     setData['temp'].top_r,
                                 //     setData['temp'].bot_r,
                                 //     setData['temp'].top_r_o,
                                 //     setData['temp'].bot_r_o,
                                 //     setData['humd'].top_r,
                                 //     setData['humd'].bot_r,
                                 //     setData['humd'].top_r_o,
                                 //     setData['humd'].bot_r_o,
                                 //     setData['co2'].top_r,
                                 //     setData['co2'].bot_r,
                                 //     setData['co2'].top_r_o,
                                 //     setData['co2'].bot_r_o,
                                 //     setData['temp'].vent_value,
                                 //     setData['temp'].vent_flg,
                                 //     setData['humd'].vent_value,
                                 //     setData['humd'].vent_flg,
                                 //     setData['co2'].vent_value,
                                 //     setData['co2'].vent_flg,
                                 //     setData['temp'].active_min_time,
                                 //     setData['humd'].active_min_time,
                                 //     setData['co2'].active_min_time,
                                 //     setData['temp'].interval_time,
                                 //     setData['humd'].interval_time,
                                 //     setData['co2'].interval_time,
                                 //     setData['temp'].danger_top_point,
                                 //     setData['temp'].danger_bot_point,
                                 //     setData['humd'].danger_top_point,
                                 //     setData['humd'].danger_bot_point,
                                 //     setData['co2'].danger_top_point,
                                 //     setData['co2'].danger_bot_point,
                                 //     setData['temp'].auto_control,
                                 //     setData['humd'].auto_control,
                                 //     setData['co2'].auto_control
                                 // ];
                                 // //RDSのMySQLにレコードを書き込む
                                 // rdsAccess.setrecord(insertParams,function(err){
                                 //     if(err){
                                 //         console.log('sensor params Insert failed.');
                                 //     } else {
                                 //         console.log('sensor params Insert Success.');
                                 //     };
                                 // });
                             });
                             console.log( 'final callback & result = ' + result );
                         });

                    } else {
                        //エラーがあったらSESでアラート送信
                        console.log('app.js: getPoints Error');
                        var num = 'observationDevice: '+lineid+':'+lineno;
                        sendMail.mailCommandSend({text:'Temp&Humd Sensor Error.'+num,
                                                                   subject:num,
                                                                    toaddress:'vitaapplication@gmail.com'});
                    }
                });
        } else {
            console.log('skip on Tick.');
        }
        update_time();
}

// skt.set('destroy upgrade',false);

var allowCrossDomain = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Origin, Referer, User-Agent, Content-Type, Authorization');

  // intercept OPTIONS method
  if (req.method === 'OPTIONS') {
    res.send(200);
  }
  else {
    next();
  }
};

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon(path.join(__dirname, 'public/images/favicon.ico')));
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(allowCrossDomain);
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.post('/api/changesetting',routes.changesetting);
app.post('/api/updateTimeSchedule',routes.updateTimeSchedule);
app.post('/api/deleteTimeSchedule',routes.deleteTimeSchedule);
app.post('/api/getTimeSchedule',routes.getTimeSchedule);
app.get('/users', user.list);

//待ち受け開始
server.listen(app.get('port'),function(){
    console.log("Node.js Server Listening on Port "+app.get('port'));
});

// skt.sockets.on('connection',function(socket){
//     console.log('socket.io connection');
//     //接続できたらメッセージを送信
//     socket.emit('observDevice',{lineid:lineid,lineno:lineno},function(data){
//                 console.log('result: '+data);
//         });

//     socket.on('message',function(data){
//         console.log('node.js on message '+' '+data);
//         socket.emit('observDevice',{lineid:lineid,lineno:lineno},function(data){
//                 console.log('result: '+data);
//         });
//     });

//     socket.on('switch_relay',function(data){
//         console.log(data);
//          if((vf_schedules["temp"] === 0) && (vf_schedules["humd"] === 0) && (vf_schedules["co2"] === 0)){
//              devicecontrol.realtimeSwitch(data.label,data.adp);
//          } else {
//              socket.emit('resMessage','スケジュール範囲内のため実行できません');
//          }
//     });

//     socket.on('nowPointGet',function(data){
//         socket.emit('nowpoint',{
//             temp:gPoints.celsius,
//             humd:gPoints.humidity,
//             co2:gPoints.co2
//         });
//     });

//     //クライアントから切断された時の処理
//     socket.on('disconnect',function(){
//         console.log('socket disconnect');
//     });
// });



function publishAWSIOT(params){
      var payload = {
              houseId:lineid+':'+lineno,
              datetime:convertDateLabel(),
              params:params
      };
      console.log(payload);
      device.publish(topic,JSON.stringify(payload));
      console.log('AWSIOT published.....');
}

function all_reset(label){
    setData[label] = {
        top_r:0,
        bot_r:0,
        top_r_o:0,
        bot_r_o:0,
        now_p:0,
        start_date:0,
        end_date:0,
        vent_value:0,
        vent_flg:0,
        active_min_time:0,
        interval_time:0,
        danger_top_point:0,
        danger_bot_point:0,
        auto_control:0
     };

     remaining_time[label] = {
       min:0,
       interval:0,
       min_flg:0,
       interval_flg:0,
       min_time:0,
       interval_time:0,
       change_flg:0
   };

   devicecontrol.off_device(label,function(){ console.log(label+': all reset done.'); });
}

function array_key_exists ( key, search ) {
    if( !search || (search.constructor !== Array && search.constructor !== Object) ){
        return false;
    }

    return key in search;
}

//flgが1の場合、経過時間を足す
function update_time(){
    for(key in remaining_time){
        if(remaining_time[key].min_flg === 1){
            remaining_time[key].min_time+=60000;
        }

        if(remaining_time[key].interval_flg === 1){
            remaining_time[key].interval_time+=60000;
        }
    }
    console.log('***** update_time *****');
    console.log(remaining_time);
};

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