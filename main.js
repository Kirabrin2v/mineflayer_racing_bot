const mineflayer = require("mineflayer");

const fs = require('fs');
const path = require("path")

const ConfigParser = require('configparser');
const config= new ConfigParser();
config.read("txt/config.ini")

var bot_username = fs.readFileSync(path.join(__dirname, 'active_nick.txt')).toString();
if (!bot_username) {
	if (config.sections().length > 0) {
		bot_username = config.sections()[0]
		fs.writeFileSync(path.join(__dirname, 'active_nick.txt'), bot_username)
	} else {
		console.log(config.sections())
		console.log('В txt/config.ini не указано ни одного ника')
		process.exit(-1)
	}
}

const bot = mineflayer.createBot({
    host: "mnrt.teslacraft.org",
    port: "25565",
    version: "1.12.2",
    hideErrors: false,
    username: bot_username});

const bot_password = config.get(bot_username, "bot_password")
const bot_pin = config.get(bot_username, "bot_pin")

let pin_enter = false;
let password_enter = false;

const seniors = ["Herobrin2v"]

var bot_bal_survings = 0;
var bot_bal_TCA = 0;

var answs = [];
var cmds = [];

var location_bot;

const queue_waiting_data = {"message": [], "cmd": []}

const tesla_ranks = [undefined, "Рядовой", "Ефрейтор", "Мл. Сержант", "Сержант", "Ст. Сержант", "Прапорщик",
					"Ст. Прапорщик", "Лейтенант", "Ст. Лейтенант", "Капитан", "Майор",
					"Подполковник", "Полковник", "Генерал", "Маршал", "Император"]

const reg_bal_survings = String.raw`Ваш баланс сурвингов: \$([0-9,]{1,10}\.[0-9]{0,2})`
const reg_bal_TCA = String.raw`Баланс баллов TCA: ([0-9]{1,5})`

const reg_nickname = String.raw`([А-яA-Za-z0-9~!@#$^*\-_=+ёЁ]{1,16})`;
const reg_message = String.raw`(.{1,256})`;
const reg_me_send = new RegExp(`^\\[${reg_nickname} -> Мне\\] ${reg_message}`)
const reg_i_send = new RegExp(`^\\[Я -> ${reg_nickname}\\] ${reg_message}`)

const reg_date_time = new RegExp('([0-9]{2})\\.([0-9]{2})\\.([0-9]{4}) ([0-9]{2}):([0-9]{2}):([0-9]{2})')

const reg_encrypted_ip = String.raw`[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}`;
const reg_lookup = new RegExp(`ஜ♒♒♒  ${reg_nickname} \\| ${reg_encrypted_ip}  ♒♒♒ஜ\n ` +
"Статус: (.*)\n " +
"Звание: (?:\\[([А-яA-z\. ]*)\\].*){0,1}\n" +
"(?: Клан:   (.*)\n){0,1}\n " +
"Забанен:   (.*)\n " +
"Имеет мут: (.*)\n\n " +
"Регистрация: (.*) \\(Мск\\)\n " +
"Был в сети:  (.*) \\(Мск\\)\n" +
"(?: Местонахождение: (.*)\n){0,1} " +
"История: ([0-9]{1,4}) бан.*\n         " +
"([0-9]{1,4}) кик.*\n         " +
"([0-9]{1,4}) мут.*\n         " +
"([0-9]{1,4}) варн.*\n" +
"(?: Последние предупреждения:\n(?:  (.*)\n){0,1}" +
"(?:  (.*)\n){0,1}" +
"(?:  (.*)\n){0,1}){0,1}" +
`ஜ♒♒♒  ${reg_nickname} \\| ${reg_encrypted_ip}  ♒♒♒ஜ`)

const reg_console_ban = new RegExp(`-------------------------------------------------------------
 Вам выдано предупреждение блюстителем Консоль!
 Причина: .*
 Набрав определённое число предупреждений, Вы будете наказаны!
-------------------------------------------------------------`)

bot.on('windowOpen', function wnd (window, info) {
	let title = window.title
	let slots = window.slots
	if (title == '"§4§l§nВведите Ваш пин-пароль"' && !pin_enter && !location_bot) {
		bot.chat(bot_pin)
		pin_enter = true;
		console.log("Пин-код введён")
	}
})


bot.on('spawn', () => {
	bot.world.on('blockUpdate:(-1697, 166, 496)', (oldBlock, newBlock) => {
		modules.call_module("win").accept_update_block(oldBlock, newBlock)
	})
})

const CommandManager = require("./command_engine.js")

class ModuleManager {
	constructor () {
		this.modules = {}

	}
	async load_modules(modules_info) {
		const load_promises = modules_info.map(async (module_info) => {
			const path = module_info[0]
			try {
				const parameters = module_info[1]
				const mod = require(path)
				if (mod.initialize) {
					mod.initialize(parameters)
				}
				if (mod.structure) {
					CommandManager.modules_structure[mod.module_name] = mod.structure
					CommandManager.modules_structure[mod.module_name]._description = mod.help
				}
				this.modules[mod.module_name] = mod
				console.log(`${mod.module_name} успешно импортирован\n`)
			
			} catch (error) {
				throw error
				//console.log(`При импортировании модуля '${path}' возникла ошибка: ${error}`)
			}
		})
		await Promise.all(load_promises)
	}
	call_module(module_name, initiator) {
		const mod = this.modules[module_name]
		if (mod) {
			return new Proxy(mod, {
				get(target, prop) {
					const value = target[prop]

					if (typeof value === 'function') {
						return (...args) => {
							try {
								return value(...args)
							} catch (error) {
								actions_processing({
									type: "error",
									content: {
										date_time: new Date(),
										module_name: module_name,
										error: error,
										args: args,
										sender: initiator
									}
								})
								//console.error(`[${requester}] Ошибка при вызове ${prop} из модуля ${moduleName}:`, e)
							}
						}
					} else {
						return value // просто значение, если не функция
					}
				}
			})

		} else {
			console.log(`Модуля ${module_name} не существует`)
		}
		return new Proxy({}, {
			get(target, prop) {
				// Если кто-то попытается вызвать любую функцию на несуществующем модуле
				return (...args) => {
					console.warn(`[${initiator || "system"}] Попытка вызвать метод "${prop}" у незагруженного модуля "${module_name}" с аргументами:`, args)
					return undefined
				}
			}
		})
	}
}

const modules = new ModuleManager()
modules.load_modules([
	["./modules/logging/logging.js"],
	["./modules/move/move.js", {"bot": bot}],
	["./modules/win_processing/win_processing.js"]
])


function count(array, value) {
    return array.reduce((accumulator, currentValue) => {
        return currentValue === value ? accumulator + 1 : accumulator;
    }, 0);
}

function parseArgs(inputString) {
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  const args = [];
  let match;
  while ((match = regex.exec(inputString)) !== null) {
    args.push(match[1] || match[2] || match[3]);
  }
  return args;
}

function send_TCA(nick, amount) {
	cmds.push(`/tca transfer ${nick} ${amount}`)
	cmds.push(`/confirm`)
}

function send_pay(nick, amount, reason="") {
	cmds.push(`/pay ${nick} ${amount} ${reason}`.slice(0, 255))
	setTimeout(() => cmds.push(`/pay confirm`), 1)
	

}

function send_cmds() {
	if (!location_bot) {
		cmds = []
		return;
	}
	if (cmds.length > 0) {
		let cmd_object = cmds.shift()
		let cmd;
		if (typeof cmd_object == "object") {
			cmd = cmd_object.cmd
		} else {
			cmd = cmd_object
		}

		if (count(cmds, cmd_object) > 5) {
			console.log("Очищено", cmd_object, count(cmds, cmd_object))
			cmds = cmds.filter((value) => value != cmd_object)
		}

		console.log("\033[36m" + cmd + "\033[0m")

		cmd = cmd.trim()
		if (cmd.length > 255) return;

		bot.chat(cmd)
		if (cmd_object.module_sender) {
			setTimeout(() => queue_waiting_data["cmd"].push(cmd_object), 10)
		}
	}
}

function module_connect(module_recipient, module_sender, json_cmd, access_lvl) {
	console.log(module_recipient, module_sender, json_cmd)
	if (typeof module_recipient == "string") {
		module_recipient = modules.modules[module_recipient]
	} 

	if (typeof module_sender == "string") {
		module_sender = modules.modules[module_sender]
	} 

	if (typeof module_recipient == "object" && typeof module_sender == "object") {
		const actions = module_recipient.module_dialogue(module_recipient, module_sender, json_cmd, access_lvl)
		actions_processing(actions)
	
	} else {
		console.log("Модуль не найден", module_recipient, module_sender)
	}
}

function send_answs() {
	if (!location_bot) return;
	if (answs.length > 0) {
		let answ = answs.shift()
		let message;
		if (typeof answ == "object") {
			let recipient = answ.recipient;
			let sender = answ.sender;
			if (sender === undefined) {
				sender = recipient;
			}
			let message = answ.message;
			if (!message || message == "") return;

			let send_in_private_message = answ.send_in_private_message;
			if (send_in_private_message === undefined) {
				send_in_private_message = true;
			}
			if (!recipient) {
				send_in_private_message = false
			}

			let chat_send = answ.chat_send

			if (chat_send !== undefined) {
				send_in_private_message = false
			} else {
				chat_send = ""
			}

			let spec_symbols = answ.spec_symbols;
			let prefix = answ.prefix;

			if (prefix) {
				message = `[${prefix}] ${message}`
			}

			//let send_full_message;
			message = message.replaceAll("\n", " ").replaceAll("\t", " ")

			if (recipient) {

				if (message[0] == "/") {
					message = message.replace("/", "\\")
				}
				if (spec_symbols) {
					
		            if (spec_symbols.includes("^")) {
						send_in_private_message = true;
					}

					if (seniors.includes(sender) && spec_symbols.includes("*")) {
						send_in_private_message = false;
					}
				}

			}

			console.log(`${recipient}'у: ${message}`, send_in_private_message)
			if (send_in_private_message) {
				if (bot_bal_survings >= 0.01 && bot.players[sender] && bot.players[sender].entity !== undefined) {
					send_pay(recipient, 0.01, message)

				} else {
					bot.chat(`/m ${recipient} ${message}`.slice(0, 255))	
				}
				
			} else if (message.length >= 255) {
				bot.chat(`${chat_send}[СБС]${message}`.slice(0, 255))

			} else {
				bot.chat(`${chat_send}${message}`)
			}
		}
	}
}

async function actions_processing(actions, module_name, update_action) {
	if (!actions) return;
	if (!actions.length) {
		actions = [actions]
	}
	actions.forEach(action => {
		let type = action.type;
		let content = action.content;
		//console.log(update_action)
		if (update_action && type == update_action.type) {
			for (key in update_action.content) {
				if (key == "send_in_private_message" && !update_action.content[key]) continue;
				content[key] = update_action.content[key]
			}
		}
		if (type == "answ") {
			if (!content.message) return;
			answs.push(content)
		} else if (type == "cmd") {
			cmds.push(content)
		} else if (type == "survings") {
			send_pay(content.nick, content.amount, content.reason)
		} else if (type == "TCA") {
			send_TCA(content.nick, content.amount)
		} else if (type == "error") {
			const error = content.error
			const recipient = content.sender
			console.log(content)
			modules.call_module("logging").add_error_to_logs(content.date_time, content.module_name, error.toString(), error.stack, content.args, content.sender)
			if (recipient) {
				actions_processing({"type": "answ", "content": {"recipient": recipient, "message": `Во время выполнения команды из ${content.module_name} произошла ошибка`}})
			}

		} else if (type == "new_survings") {
			payment_processing(content.payer, content.amount, "survings", content.reason)
		} else if (type == "new_TCA") {
			payment_processing(content.payer, content.amount, "TCA")
		
		} else if (type == "update_stats")  {
			console.log("update_stats", content)
			modules.call_module("stats").update_stats(content.nickname, content.key, content.value, content.type)

		} else if (type == "module_request") {
			module_connect(action.module_recipient, action.module_sender, content, action.access_lvl)
		} else if (type == "wait_data") {
			queue_waiting_data[content.type].push({"time_create": new Date().getTime(), "module_name": action.module_name, "content": content})
		}
	})
}

function check_loc_bot() {
	let tablist = bot.tablist.header.text.split("\n")
	if (tablist.length >= 3) {
		let new_location_bot = tablist[2].split("» §b§l")[1].split(" §e§l«")[0];
		if (new_location_bot != location_bot) {
			if (location_bot) {
				console.log(`Бот переместился с ${location_bot} на ${new_location_bot}`)
				location_bot = new_location_bot;

			} else {
				location_bot = new_location_bot;
				console.log(`Бот появился на локации ${new_location_bot}`)
			}
		} else {
			location__bot = tablist.join(" ");
		}
	}
}

function wait_data_processing(type, content) {
	for (let i=0; i < queue_waiting_data[type].length; i++) {
		const data = queue_waiting_data[type][i]
		//console.log("Вэйт дата", type, content, data)

		if (data.time_create && new Date().getTime() - data.time_create > 300000) {
			queue_waiting_data[type].splice(i, 1)
			continue;
		}
		if (type == "message") {
			if (data.content.sender == content.sender) {
				const in_private_message = data.content.private_message
				const pattern = data.content.pattern
				const message = content.message
				if (!in_private_message || content.private_message) {
					if (!pattern || message.match(pattern)) {
						const module_object = modules.modules[data.module_name]
						if (module_object) {
							module_object.message_processing(content.sender, message, content.type_chat)
							queue_waiting_data[type].splice(i, 1)
							break;
						} else {
							console.log("Модуль не найден")
						}

					}
				}
			}
		} else if (type == "cmd") {
			const module_object = modules.modules[data.module_sender]
			if (module_object) {
				module_object.server_answ_processing(data.cmd, content.server_answ, content.values, data.identifier, content.is_confirmed)
			}
			queue_waiting_data[type].splice(i, 1)
			break;
		}
	}
}

bot.on('messagestr', (message, sender, message_json) => {
	if (!message || !sender) return;
	//console.log(sender, message)
	if (sender == "chat") {
		const raw_message = message;
		let private_message = message.match(reg_me_send);
		if (private_message) {
			sender = private_message[1]
			message = private_message[2]
			var type_chat = "Приват";

		} else {
			var type_chat = message.split("]")[0].split("[")[1]
			sender = message.split(":")[0].split(" ").at(-1)
			message = message.split(": ").slice(1).join(": ")
			
			if (type_chat != "Пати-чат" && type_chat != "Лк" && type_chat != "Гл") {
				type_chat = undefined;
			}
			
		}
		if (!message || !sender) return;

		console.log(`[${type_chat}]` + "\033[32m " + sender + ":\033[33m " + message + "\033[0m")

		wait_data_processing("message", {"type_chat": type_chat, "message": message, "sender": sender, "private_message": Boolean(private_message)})
		modules.call_module("logging").add_msg_to_players_logs(new Date(), location_bot, type_chat, sender, message, raw_message, JSON.stringify(message_json.json))

		message = message.replace(/[c|C][m|M][d|D]/, "cmd")
		let cmd;
		let chat_send;
		let send_in_private_message;
		let flags;

		if (message.toLowerCase().includes("cmd ")) {
			let flags_match = message.split("cmd ")[0].matchAll(/-([^ -]*)(?: |$)/g)
			let count_flags = 0;
			for (let flag of flags_match) {
				flag = flag[1].toLowerCase()
				console.log("Флаг",flag)
				if (flag == "cc") {
					chat_send = "/cc "

				} else if (flag == "pc") {
					chat_send = "/pc "

				} else if (flag == "p") {
					send_in_private_message = true;

				} else if (flag == "l") {
					chat_send = ""

				} else if (flag == "g" && seniors.includes(sender)) {
					chat_send = "!"
				} else {
					flags.push(flag)
				}
				if (count_flags == 5) {
					break;
				}
			}

			message = message.split("cmd ")[1]
			message = message.split(" ")
			cmd = message[0].toLowerCase()
			args = parseArgs(message.slice(1).join(" "))

			cmd_parameters = {"cmd": cmd, "seniors": seniors, "location_bot": location_bot}
		}
		if (cmd) {
			if (modules.modules[cmd]) {
				module_object = modules.call_module(cmd, sender)
				console.log(cmd, args, module_object.cmd_access)
				const valid_command = CommandManager.validate_command(module_object.module_name, args)
				if (valid_command["is_ok"]) {
					console.log("Команда валидна")
					let actions = module_object.cmd_processing(sender, args, cmd_parameters, valid_command.args)
					let update_action = {type: "answ", content: {"chat_send": chat_send, "send_in_private_message": send_in_private_message}}
					actions_processing(actions, undefined, update_action)

				} else {
					answs.push({"recipient": sender, "message": valid_command["message_error"]})
				}
			} else if (seniors.includes(sender)) {
				if (cmd == "js") {
					try {
						eval(args.join(" "))
					} catch (error) {
						console.log(error)
					}
				} else {
					bot.chat(`${cmd} ${args.join(" ")}`.trim())
					return;
				}
			}
		}
	} else {
		let wait_cmd;
		let now_cmd;
		let values;
		let count_args = 1;
		if (queue_waiting_data["cmd"].length != 0) {
			wait_cmd = queue_waiting_data["cmd"][0].cmd
			//wait_data_processing("cmd", {"server_answ": message})
		}

		const lookup = message.match(reg_lookup)

		const bal_TCA = message.match(reg_bal_TCA)
		const bal_survings = message.match(reg_bal_survings)

		const console_ban = message.match(reg_console_ban)

		if (!bal_TCA && !bal_survings)
		console.log(`${sender}: ${message}`)

		if ([
			"Нужно авторизоваться. Напишите в чат Ваш пароль",
			"Забыли пароль? Восстановите его с помощью команды /Recovery <Почта>"
			].includes(message) && !password_enter) {
			bot.chat(`/login ${bot_password}`)
			password_enter = true;

		} else if (bal_survings) {
			now_cmd = "bal"
			
			bot_bal_survings = Number(bal_survings[1].replace(/,/g, ""))
			
		
		} else if (lookup) {
			now_cmd = "lookup"

			const nickname = lookup[1]
			const online = lookup[2] == "Онлайн"
			const rank = tesla_ranks.indexOf(lookup[3])
			const clan = lookup[4]
			const active_ban = lookup[5]
			const active_mute  = lookup[6]

			const [day_reg, month_reg, year_reg, hours_reg, minutes_reg, seconds_reg] = lookup[7].match(reg_date_time).slice(1)
			const date_reg = new Date(year_reg, month_reg, day_reg, hours_reg, minutes_reg, seconds_reg)

			const [day_last_online, month_last_online, year_last_online, hours_last_online, minutes_last_online, seconds_last_online] = lookup[8].match(reg_date_time).slice(1)
			const date_last_online = new Date(year_last_online, month_last_online, day_last_online, hours_last_online, minutes_last_online, seconds_last_online)

			const location_player = lookup[9]
			const count_bans = lookup[10]
			const count_kicks = lookup[11]
			const count_mutes = lookup[12]
			const count_warns = lookup[13]
			const last_warn_1 = lookup[14]
			const last_warn_2 = lookup[15]
			const last_warn_3 = lookup[16]
			
			values = {'nickname': nickname, 'online': online, 'rank': rank, 'clan': clan, 'active_ban': active_ban,
			'active_mute': active_mute, 'date_reg': date_reg, 'date_last_online': date_last_online,
			'location_player': location_player, 'count_bans': count_bans, 'count_kicks': count_kicks, 'count_mutes': count_mutes,
			'count_warns': count_warns, 'last_warns': [last_warn_1, last_warn_2, last_warn_3]}
			console.log("Валуес", values)
		
		} 

		if (wait_cmd) {
			let confirmed = false;
			if (now_cmd == wait_cmd.trim().split(" ").slice(0, count_args).join(" ").replace("/", "")) {
				confirmed = true;
			}
			wait_data_processing("cmd", {server_answ: message, values: values, is_confirmed: confirmed})
		}
		}
})

bot.on('kicked', (reason, loggedIn) => {
	if (reason.includes("§4§l§n  БАН  §5§m")) {
		const bots = config.sections()
		let now_index = bots.indexOf(bot_username)
		const new_index = (now_index + 1) % bots.length
		const new_bot_username = bots[new_index]
		console.log(bots, new_bot_username, new_index, [now_index, bots.length])
		fs.writeFileSync(path.join(__dirname, 'active_nick.txt'), new_bot_username)
		console.log(`Бот ${bot_username} забанен`)
		process.exit(-1);
	} 
})

setInterval(check_loc_bot, 3000)

function check_return_move() {
	let actions = modules.call_module("ручуп").get_actions()
	actions_processing(actions)
}

setInterval(check_return_move, 500)

setInterval(send_answs, 2000)
setInterval(send_cmds, 600)

setInterval(() =>  {
	if (location_bot && location_bot.includes("Классическое выживание")) {
		bot.chat("/bal")
	}
}, 10000)

setInterval(() => {
	if (!location_bot || !location_bot.includes("Локация Незер")) {
		bot.chat("/shome")
	}
}, 5000)

setInterval(check_loc_bot, 5000)

function check_return_win() {
	let actions = modules.call_module("win").get_actions()
	actions_processing(actions)
}

setInterval(check_return_win, 1000)