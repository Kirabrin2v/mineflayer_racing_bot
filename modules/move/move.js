const module_name = "ручуп"
const help = "Управление ботом"

const structure = {
	version: {
		_type: "int",
		_optional: true,
		_description: "Способ управления ботом. Номер \"3\" - управление с помощью блоков шерсти"
	}
}

const fs = require('fs');
const path = require("path")

let checked_players = JSON.parse(fs.readFileSync(path.join(__dirname, 'checked_players.json'), 'utf8').toString())

function update_json() {
	fs.writeFileSync(path.join(__dirname,'checked_players.json'), JSON.stringify(checked_players, null, 2))
}

var bot;

function initialize(constants) {
	bot = constants.bot
	bot.on('death', () => {
		if (control_player.nick) {
			actions.push({
				type: "answ",
				content: {
					recipient: control_player.nick,
					message: "Бот оказался слишком хрупким для таких манёвров. Попробуйте заново"
				}
			})
		}
		clear_control_player()
	})

}
let seniors = []

const session_limit_time = 260000;
const active_session_time = 15000;
let bot_position = {}

let actions = []

const available_versions = [1,2,3]

let control_player = {}
let queue_players = []

const ONE_DAY = 86400 * 1000;

function control_head(delta_yaw, delta_pitch) {
	let [yaw, pitch] = [bot.entity.yaw, bot.entity.pitch]

	yaw -= delta_yaw
	pitch -= delta_pitch

	if (pitch > 0) {
		pitch = Math.min(1.5707963267948966, pitch)
	} else {
		pitch = Math.max(-1.5707963267948966, pitch)
	}
	yaw = yaw % 6.258641614573416

	bot.look(yaw, pitch, true)
}

function repeat_head_position(nickname) {
	/*
	Принимает такое же положение головы, как и у указанного игрока
	*/
	if (bot.players[nickname] && bot.players[nickname].entity) {
		const yaw = bot.players[nickname].entity.yaw
		const pitch = bot.players[nickname].entity.pitch
		bot.look(yaw, pitch, true)
	}
}

function control_state_with_keyboard(key, is_press) {
	/*
	Функция для управления перемещением бота с помощью клавиатуры.
	*/
	if (control_player.version != 1) return;
	if (key == "w") {
		if (is_press) {
			bot.setControlState("forward", true)
		} else {
			bot.setControlState("forward", false)
		}

	} else if (key == "s") {
		if (is_press) {
			bot.setControlState("back", true)
		} else {
			bot.setControlState("back", false)
		}
	
	} else if (key == "d") {
		if (is_press) {
			bot.setControlState("right", true)
		} else {
			bot.setControlState("right", false)
		}
	
	} else if (key == "a") {
		if (is_press) {
			bot.setControlState("left", true)
		} else {
			bot.setControlState("left", false)
		}
	} else if (key == "space") {
		if (is_press) {
			bot.setControlState("jump", true)
		} else {
			bot.setControlState("jump", false)
		}
	}
}

function control_bot_with_blocks(nickname) {
	/*
	В зависимости от блоков, находящихся в видимой всем части инвентаря,
	бот выполняет определённое действие
	*/
	let move_actions = []
	if (bot.players[nickname] && bot.players[nickname].entity) {
		const items = bot.players[nickname].entity.equipment
		const id_items = items
		.filter((item) => item != undefined)
		.map((item) => {
			return item.metadata
		})
		if (id_items.includes(9)) {
			repeat_head_position(nickname)			
		}

		if (id_items.includes(13)) {
			bot.setControlState("jump", true)
			move_actions.push("jump")
		} else {
			bot.setControlState("jump", false)
		}

		if (id_items.includes(5)) {
			bot.setControlState("forward", true)
			move_actions.push("forward")
		} else {
			bot.setControlState("forward", false)
		}

		if (id_items.includes(14)) {
			bot.setControlState("back", true)
			move_actions.push("back")
		} else {
			bot.setControlState("back", false)
		}

		if (id_items.includes(1)) {
			bot.setControlState("left", true)
			move_actions.push("left")
		} else {
			bot.setControlState("left", false)
		}

		if (id_items.includes(10)) {
			bot.setControlState("right", true)
			move_actions.push("right")
		} else {
			bot.setControlState("right", false)
		}
	} else {
		bot.clearControlStates()
	}
	control_player.active_actions = move_actions;
}

function check_bot_food() {
	if (bot.food != 20 && !control_player.nick) {
		bot.chat("/swarp death")
	} 
}

function break_session_by_time_limit() {
	actions.push({
		type: "answ",
		content: {
			recipient: control_player.nick,
			message: "К сожалению, время вышло. Попробуйте ещё раз!"
		}
	})
	clear_control_player()
}

function check_active_session() {
	const now_pos = bot.entity.position
	if (bot_position.x == now_pos.x && bot_position.z == now_pos.z) {
		actions.push({
			type: "answ",
			content: {
				recipient: control_player.nick,
				message: `Вы бездействовали более ${active_session_time/1000}с, поэтому игра была прервана`
			}
		})
		clear_control_player()
	} 
	bot_position = now_pos
}

function clear_control_player() {
	if (control_player.version == 3) {
		clearInterval(control_player.interval_check)
	}
	if (control_player.session_limit_check) {
		clearTimeout(control_player.session_limit_check)
	}
	if (control_player.session_active_check) {
		clearInterval(control_player.session_active_check)
	}

	control_player = {}
	bot.clearControlStates()
	actions.push({
		type: "cmd",
		content: {
			cmd: "/shome"
		}
	})

	if (queue_players.length != 0) {
		let queue_player = queue_players.shift()
		let answ = create_control_player(queue_player.nickname, queue_player.version)
		if (answ) {
			actions.push({
				type: "answ",
				content: {
					recipient: queue_player.nickname,
					message: answ
				}
			})
		} 
	}
}

function create_control_player(nickname, version=3) {
	let answ;
	control_player = {
		nick: nickname,
		version: version,
		start_time: new Date().getTime()
	}
	if (version == 1) {
		answ = "Теперь Вы управляете ботом. Не забудьте включить кейлоггер и локальный сервер"

	} else if (version == 3) {
		control_player.interval_check = setInterval(() => {
				control_bot_with_blocks(nickname)
			}, 1)
		answ = "Теперь Вы управляете ботом. Необходимые цвета шерсти: бирюзоывй(взгляд), оранжевый(←), лаймовый(↑), красный(↓), фиолетовый(→), зелёный(прыжок)"
	}
	if (!seniors.includes(nickname)) {
		control_player.session_limit_check = setTimeout(break_session_by_time_limit, session_limit_time)
		control_player.session_active_check = setInterval(check_active_session, active_session_time)
	}
	return answ
}

function switch_control_player(nickname, version) {
	let is_ok = true;
	let answ;
	if (control_player.nick == nickname) {
		clear_control_player()
		answ = "Управление успешно выключено"
	} else {
		if (seniors.includes(nickname)) {
			answ = `Вы украли управление ${control_player.version} у игрока ${control_player.nick}`
			actions.push({
				type: "answ",
				content: {
					recipient: control_player.nick,
					answ: `${nickname} отобрал у Вас управление ботом`
				}
			})
			clear_control_player()
			create_control_player(nickname, version)
		} else {
			is_ok = false;
			if (queue_players.includes(nickname)) {
				let count_queue_players = queue_players.findIndex((el) => el.nickname == nickname) + 1;
				answ = `Вы уже стоите в очереди. Перед Вами игроков: ${count_queue_players}`
			} else {
				let count_queue_players = queue_players.length + 1;
				answ = `Вы не можете сейчас управлять ботом, так как это делает ${control_player.nick}. Поставил Вас в очередь. Как только она подойдёт - передам Вам управление. Игроков перед Вами: ${count_queue_players}`
				queue_players.push({nickname: nickname, version: version})
			}
		}
	}
	return {"is_ok": is_ok, "answ": answ}
}


function cmd_processing(sender, args, cmd_parameters, valid_args) {
	args = valid_args;
	seniors = cmd_parameters.seniors
	let answ;
	if (!checked_players.hasOwnProperty(sender)) {
		actions.push({
			type: "cmd",
			content: {
				cmd: `/lookup ${sender}`,
				module_sender: module_name
			}
		})
		return;
	}
	if (!args[0]) {
		// Значение по умолчанию
		if (seniors.includes(sender)) {
			args[0] = {"name": "version", "value": 1}
		} else {
			args[0] = {"name": "version", "value": 3}
		}

	} else {
		let version = Number(args[0].value)
		if (available_versions.includes(version)) {
			if (control_player.nick) {
				let switch_info = switch_control_player(sender, version)
				answ = switch_info.answ
			} else {
				answ = create_control_player(sender, version)
			}
		} else {
			answ = "Выбранной версии управления не существует"
		}
	}

	if (answ) {
		return {
			type: "answ",
			content: {
				recipient: sender,
				message: answ
			}
		}
	}
}


function control_head_with_pixels(delta_x, delta_y) {
	if (control_player.version != 1) return;

	const sensitivity = 100
	need_pixes = 688.07 / (sensitivity - 24.57)
	const pitch = delta_y / need_pixes * 0.024543692606170175

	const yaw = delta_x / need_pixes * 0.024543692606170175
	control_head(yaw, pitch)
}

function server_answ_processing(cmd, server_answ, values, identifier, is_confirmed) {
	if (cmd.startsWith("/lookup")) {
		console.log(server_answ)
		if (is_confirmed) {
			const date_reg = values.date_reg
			const nickname = values.nickname
			const delta_time = Date.now() - date_reg
			console.log(`Аккаунту игрока ${nickname} ${delta_time} секунд`)
			let valid_player = true;
			if (delta_time < 20 * ONE_DAY) {
				valid_player = false;
				actions.push({
					type: "answ",
					content: {
						recipient: nickname,
						message: "К сожалению, Вы не можете участвовать в конкурсе, так как зарегистрированы слишком недавно"
					}
				})
			}
			checked_players[nickname] = valid_player
			actions.push({
					type: "answ",
					content: {
						recipient: nickname,
						message: "Проверка пройдена успешно. Пожалуйста, повторно напишите команду"
					}
				})
			console.log(checked_players)
		}
	}
}

function module_dialogue(module_recipient, module_sender, json_cmd) {
	console.log("Зашло в module_dialogue move.js")
	if (json_cmd.type == "answ") {
		
	} else if (json_cmd.type == "request") {
		if (json_cmd.cmd == "get") {
			let data = {}
			const args = json_cmd.args
			if (args.includes("control_player")) {
				data.control_player = control_player
			}
			return {
				type: "module_request",
				module_sender: module_recipient,
				module_recipient: module_sender,
				content: {
					type: "answ",
					data: data
				}
			}
		} else if (json_cmd.cmd == "clear_control_player") {
			clear_control_player()
		}
	}
}


function get_actions() {
	return actions.splice(0)
}

function diagnostic_eval (eval_expression) {
	try {
		return eval(eval_expression)
	} catch (error) {
		return error
	}
}

setInterval(update_json, 5000)
setInterval(check_bot_food, 5000)

module.exports = {module_name, initialize, diagnostic_eval, control_head, control_head_with_pixels, control_state_with_keyboard, cmd_processing, get_actions, help, server_answ_processing, module_dialogue, structure}











// function check_loc_bot() {
// 	let tablist = bot.tablist.header.text.split("\n")
// 	if (tablist.length >= 3) {
// 		let new_location_bot = tablist[2].split("» §b§l")[1].split(" §e§l«")[0];
// 		if (new_location_bot != location_bot) {
// 			if (location_bot) {
// 				console.log(`Бот переместился с ${location_bot} на ${new_location_bot}`)
// 				if (!location_bot.includes("Классическое выживание") && new_location_bot.includes("Классическое выживание")) {
// 					if (!timer_check_surv || timer_check_surv._destroyed) {
// 						timer_check_surv = setTimeout(() => {bot.chat("/bal")}, interval_check_surv)
// 					}
// 				}
// 				location_bot = new_location_bot;

// 			} else {
// 				location_bot = new_location_bot;
// 				console.log(`Бот появился на локации ${new_location_bot}`)
// 				//tg.start()
// 			}
// 		} else {
// 			location__bot = tablist.join(" ");
// 		}
// 	}
// }
