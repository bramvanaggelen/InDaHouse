const Discord = require('discord.js');
const client = new Discord.Client();
const mysql = require('mysql');
const sanitizer = require('sanitize')();
const moment = require('moment');
let connection = null;
let configuration = require('./config.js');
let votableMessages = [];
configuration = configuration.configuration;

function connectMysql(){
    connection = mysql.createConnection({
        host:configuration.db_host,
        user:configuration.db_user,
        password:configuration.db_password,
        database:configuration.db_database,
    });

    // Connecting:
    connection.connect(function(err) {
        if(err) throw err;
        console.log('MySQL is running');
    });

    // Handling Idle Timeouts:
    connection.on('error', function(err) {
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('MySQL connection dropped. Attempting to reconnect...');
            connectMysql();
        } else {
            throw err;
        }
    });
}

client.once('ready',()=>{
   console.log('I AM READY FOR YOU MY MASTER');
   connectMysql();
});

client.on('message', (message) => {
    if(message.content[0] != configuration.bot_key){
        return;
    }
    const possibleFields = ['name','time','max-players','captains','description'];
    let args = message.content.substring(1);
    const command = args.substring(0,args.indexOf(' ') != -1 ? args.indexOf(' ') : args.length);
    args = args.indexOf(' ') != -1 ? args.substring(args.indexOf(' ')+1) : '';
    console.log(command,args);
    let serverId = 0;
    connection.query("SELECT * FROM servers WHERE discord_id = ?" ,[sanitizer.value(message.channel.guild.id,'int')],function (err,result){
        if(err){
            console.log("error");
            console.log(err)
            throw err;
        }
        const serverInfo = result[0];
        serverId = serverInfo.id;

        switch (command){
            case 'new':
                if(!possibleFields.includes(args)){
                    let name = serverInfo.name
                    if(args != "")
                        name = args;
                    newEvent(serverInfo,name);
                    message.channel.send("New event with the name `"+name+"` made");
                }
                else
                    message.channel.send("The chosen name is not allowed");
                break;
            case 'set':
            case 'update':
                let words = [
                    args.substring(0,args.indexOf(' ') != -1 ? args.indexOf(' ') : args.length),
                    args.indexOf(' ') != -1 ? args.substring(args.indexOf(' ')+1) : '',
                ]
                if(possibleFields.includes(words[0])){
                    connection.query("SELECT name FROM events WHERE server_id = ? ORDER BY updated_at DESC LIMIT 0,1",[serverId],function (err,result){
                        if(result.length) {
                            handleUpdate(serverId,result[0].name, words)
                        }
                        else
                            message.channel.send("No event found");
                    });
                }
                else{
                    connection.query("SELECT name FROM events WHERE server_id = ? AND name = ?",[serverId,sanitizer.value(words[0],'str')],function (err,result){
                        if(err){
                            console.log(err)
                            throw err;
                        }
                        if(result.length ==0){
                            message.channel.send("Event "+sanitizer.value(words[0],'str')+" is not found");
                            return;
                        }
                        else{
                            words = [
                                words[1].substring(0,words[1].indexOf(' ') != -1 ? words[1].indexOf(' ') : args.length),
                                words[1].indexOf(' ') != -1 ? words[1].substring(words[1].indexOf(' ')+1) : '',
                            ]
                            handleUpdate(serverId,result[0].name,words);
                        }
                    });
                }
                break;
            case 'start':
                if(args == ''){
                    connection.query("SELECT name FROM events WHERE server_id = ? ORDER BY updated_at DESC LIMIT 0,1",[serverId],function (err,result){
                        if(result.length) {
                            sendInfoMessage(result[0].name, serverId,true)
                        }
                        else
                            message.channel.send("No event found");
                    });
                }
                else{
                    sendInfoMessage(args,serverId, true)
                }
                break;
            case 'status':
                if(args == ''){
                    connection.query("SELECT name FROM events WHERE server_id = ? ORDER BY updated_at DESC LIMIT 0,1",[serverId],function (err,result){
                        if(result.length) {
                            sendInfoMessage(result[0].name, serverId)
                        }
                        else
                            message.channel.send("No event found");
                    });
                }
                else{
                    sendInfoMessage(args,serverId)
                }
                break;
            case 'help':
            default:
                let helptext = "This is a bot written by Bram. The following commands can be executed:\n" +
                    "```new {name}: This command makes a new event with the name {name}. Which you can later update.```" +
                    "```update/set {eventName?} {classifier} {value}: Updates the event with the name evenName, if its not put in it will use the last updated one. " +
                    "the classifier can be ['name','time','max-players','captains','description'].\nName is the name of the event, time is when it will take place, " +
                    "max-players is the amount of players needed before the making of the teams begins and the registration is disabled, captains is the amount of captains " +
                    "description is any other information you want to say about the event which will be shown when the registration is enabled```" +
                    "```start {eventName?}: start the event which shows the message people can react to to say they will play. EventName can be used to trigger a specific event, but it will by default use the last changed one```" +
                    "```status {eventName?}: show the event information but people wont be able to say they will play. EventName can be used to trigger a specific event, but it will by default use the last changed one```";
                message.channel.send(helptext);
                break;
        }
    });

    function newEvent (serverInfo,name){
        connection.query("INSERT INTO events (`server_id`,`name`,`updated_at`) VALUES (?,?,NOW())",[serverInfo.id,name],function (err,result){
            if(err){
                console.log(err)
                throw err;
            }
        });
    }

    function handleUpdate(serverId,eventName,words){
        const stringable = ['name','description'];
        const intable = ['max-players','captains'];
        if(stringable.includes(words[0]))
            words[1] = sanitizer.value(words[1],'str')
        if(intable.includes(words[0]))
            words[1] = sanitizer.value(words[1],'int')
        if(words[0] == 'time') {
            words[1] = moment(words[1]).format("YYYY-MM-DD HH:mm:ss");
            if(words[1] == 'Invalid date') {
                message.channel.send("Invalid date provided.");
                return;
            }
        }

        updateEvent(serverId,eventName,words[0],words[1]);
    }

    function updateEvent(serverId,eventName,update,newValue){
        connection.query("UPDATE events SET `"+update+"`=? WHERE name = ? AND server_id = ?",[newValue,eventName,serverId],function (err,result){
            if(err){
                console.log(err);
                throw err;
            }
            if(result.affectedRows > 0){
                message.channel.send("The event has been updated.");
                if(update == 'name')
                    eventName = newValue;
                sendInfoMessage(eventName,serverId);
            }
        });
    }

    function sendInfoMessage(eventName,serverId,isStart = false){
        connection.query("SELECT * FROM events WHERE server_id = ? AND name = ? ORDER BY updated_at DESC LIMIT 0,1",[serverId,eventName],function (err,result){
            if(err){
                console.log(err)
                throw err;
            }
            let to_send = "";
            if(result.length) {
                result = result[0];
                to_send += "Event:"+result.name+"\n";
                if(result.description)
                    to_send += result.description +"\n";
                if(result.time)
                    to_send += "Will be held "+moment(result.time).fromNow()+"\n";
                if(result['max-players'])
                    to_send += "With a maximum of "+result['max-players'] +" players \n";
                if(parseInt(result['captains'])+'' === result['captains'])
                    to_send += "And "+result['captains'] +" captains \n";
                else if(result.captains){
                    //json.parse
                }
                if(isStart)
                    to_send += "Reply with :white_check_mark:  to say you will be there";
                message.channel.send(to_send).then((message) =>{
                    if(isStart){
                        message.react('✅');
                        connection.query("UPDATE events SET `message_id`=?, players=NULL WHERE name = ? AND server_id = ?",[message.id,eventName,serverId],function (err,result){
                            if(err){
                                console.log(err);
                                throw err;
                            }
                        });
                    }
                });
            }
            else{
                message.channel.send("Event "+eventName+" is not found");
            }
        });
    }
});

client.on('messageReactionRemove',(messageReaction,user)=> {
    if (user.bot)
        return;
    if (messageReaction["_emoji"].name === "✅") {
        connection.query("SELECT * FROM events WHERE message_id=?",[messageReaction.message.id], function (err, result) {
            if (err) {
                console.log(err);
                throw err;
            }
            result = result[0];
            let people = JSON.parse(result.players);
            if (people == null)
                people = [];
            for(let i in people){
                let person = people[i];
                if(person.id == user.id){
                    people.splice(i,1);
                }
            }
            connection.query("UPDATE events SET players = ? WHERE message_id=?",[JSON.stringify(people),messageReaction.message.id]);
        });
    }
});

client.on('messageReactionAdd',(messageReaction,user)=>{
    if(user.bot)
        return;
    if(messageReaction["_emoji"].name === "✅"){
        connection.query("SELECT * FROM events WHERE message_id=?",[messageReaction.message.id],function (err,result){
            if(err){
                console.log(err);
                throw err;
            }
            result = result[0];
            let people = JSON.parse(result.players);
            if(people == null)
                people = [];
            people.push({
                id:user.id,
                name:user.username,
                team:0
            });
            connection.query("UPDATE events SET players = ? WHERE message_id=?",[JSON.stringify(people),messageReaction.message.id]);
            if(people.length == result['max-players']){
                startSelection(result.server_id,result.name,messageReaction.message.channel);
            }
        });
    }
    else{
        if(Object.keys(votableMessages).includes(messageReaction.message.id) && user.id == votableMessages[messageReaction.message.id]){
            const emojiNames = ['1⃣','2⃣','3⃣','4⃣','5⃣','6⃣','7⃣','8⃣','9⃣','0⃣'];
            if(emojiNames.includes(messageReaction["_emoji"].name)){
                connection.query("SELECT * FROM events WHERE message_id = ?",[messageReaction.message.id],function (err,result){
                    if(err){
                        console.log(err);
                        throw err;
                    }
                    result = result[0];
                    let players = JSON.parse(result.players);
                    const pickablePlayers = players.filter((obj)=>{return obj.team === 0});
                    const pickedKey = emojiNames.indexOf(messageReaction['emoji'].name);
                    const pickedPlayer = pickablePlayers[pickedKey];
                    if(!pickedPlayer)
                        return;
                    const captain = players.find((obj)=>{return obj.id === user.id});
                    for(let i in players){
                        let player = players[i]
                        if(player.id == pickedPlayer.id){
                            players[i].team = captain.team;
                        }
                    }
                    votableMessages.splice(messageReaction.message.id,1);
                    messageReaction.message.delete({ timeout: 1000 });
                    result.players = players;
                    result.captains = JSON.parse(result.captains);
                    connection.query("UPDATE events SET players = ? WHERE id=?",[JSON.stringify(players),result.id]);
                    selectTeammate(messageReaction.message.channel,result);
                });
                // const pickablePlayers
            }
        }
    }
});



client.on('guildCreate',(server)=>{
    connection.query("SELECT * FROM servers WHERE discord_id = ?",[sanitizer.value(server.id, 'int')],function (err,result){
        if(err){
            console.log(err,result);
            throw err;
        }
        if(result.length){
            console.log('server already exists with id: '+server.id);
        }
        else{
            connection.query("INSERT INTO servers (`name`,`discord_id`) VALUES (?,?)",[sanitizer.value(server.name,'str'),sanitizer.value(server.id,'int')],function (err2,result2){
                if(err2){
                    console.log(err2,result2);
                    throw err2;
                }
                else
                    console.log("Server "+server.name+" added to the database");
            });
        }
    });
});

client.on('guildDelete',(server)=>{
    connection.query("DELETE FROM servers WHERE discord_id = ?",[sanitizer.value(server.id, 'int')],function (err,result){
        if(err){
            console.log(err,result);
            throw err;
        }
        if(result.affectedRows > 0){
            console.log('Server deleted: '+server.name);
        }
    });
});

client.on('guildUpdate',(oldServer,newServer)=>{
    connection.query("UPDATE servers SET name = ? WHERE discord_id = ?",[sanitizer.value(newServer.name,'str'),sanitizer.value(newServer.id, 'int')],function (err,result){
        if(err){
            console.log(err,result);
            throw err;
        }
        if(result.affectedRows > 0){
            console.log('Server updated: '+newServer.name);
        }
    });
});

function startSelection(serverId,eventName,channel){
    connection.query("SELECT * FROM events WHERE server_id = ? AND name = ? ORDER BY updated_at DESC LIMIT 0,1",[serverId,eventName],function (err,result){
        if(err){
            console.log(err)
            throw err;
        }
        if(result.length) {
            result = result[0];
            let players = JSON.parse(result.players);
            let captains = [];
            let message = "The captains of this match will be: :drum: \n ";
            if(parseInt(result.captains)+"" == result.captains) {
                for (let i = 0; i < result.captains; i++) {
                    let captain = Math.floor(Math.random() * (players.length - 0.01));
                    let player = players[captain];
                    player.team = i + 1;
                    captains.push(player);
                    players.splice(captain, 1);
                    message += i == result.captains - 1 ? " and <@" + player.id + ">" : "<@" + player.id + ">"
                }
            }
            else
                captains = JSON.parse(result.captains);
            players = players.concat(captains);
            connection.query("UPDATE events SET players = ?,captains = ? WHERE id=?",[JSON.stringify(players),JSON.stringify(captains),result.id]);
            result.players = players;
            result.captains = captains;
            message += "\n the choosing of teammates will begin shortly!"
            channel.send(message);
            selectTeammate(channel,result);
        }
    });
}

function selectTeammate(channel,eventInfo){
    const emojiNames = ['1⃣','2⃣','3⃣','4⃣','5⃣','6⃣','7⃣','8⃣','9⃣','0⃣'];
    let message = "The teams are currently the following: \n";
    let lowestCaptain = null;
    for(let i in eventInfo.captains){
        let captain = eventInfo.captains[i];
        eventInfo.captains[i].teammates = 0;
        const teamPlayers = eventInfo.players.filter((obj)=>{return obj.team === captain.team && obj.id !== captain.id});
        message += "Team <@"+captain.id+">: \n:one: <@"+captain.id+">:\n";
        for(let j in teamPlayers){
            eventInfo.captains[i].teammates = eventInfo.captains[i].teammates +1;
            message += emojiNames[parseInt(j)+1] + " <@"+teamPlayers[j].id+">\n";
        }
        if(lowestCaptain == null)
            lowestCaptain = eventInfo.captains[i];
        else if(lowestCaptain.teammates > eventInfo.captains[i].teammates)
            lowestCaptain = eventInfo.captains[i];
        message += "\n"
    }
    const pickablePeople = eventInfo.players.filter((obj)=>{return obj.team ===0});
    let maxI = 0;
    if(pickablePeople.length > 0){
        message += "The next captain that can choose is: <@"+lowestCaptain.id+"> \nPeople that can still be chosen:\n";
        for(let i in pickablePeople){
            message += emojiNames[i] + " <@"+pickablePeople[i].id+"> \n";
            maxI = i;
        }
    }
    else {
        message += "All teams are full, no players yet to be selected so have fun playing!";
    }
    channel.send(message).then(async (message) =>{
        if(pickablePeople.length > 0){
            votableMessages[message.id] = lowestCaptain.id;
            connection.query("UPDATE events SET `message_id`=? WHERE id = ?",[message.id,eventInfo.id]);
                try {
                for(let i = 0; i <= maxI;i++){
                    await message.react(emojiNames[i]);
                }
            } catch (error) {
                console.error('One of the emojis failed to react.');
            }
        }
        });
}

client.login(configuration.bot_token);