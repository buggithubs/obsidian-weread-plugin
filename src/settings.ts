import { Cookie } from 'set-cookie-parser';
import { writable } from 'svelte/store';

import WereadPlugin from '../main';

interface WereadPluginSettings {
	cookies: Cookie[];
	noteLocation: string;
	lastCookieTime: number;
	isCookieValid: boolean;
	user: string;
}

const DEFAULT_SETTINGS: WereadPluginSettings = {
	cookies: [],
	noteLocation: '/weread',
	lastCookieTime: -1,
	isCookieValid: false,
	user: ''
};

const createSettingsStore = () => {
	const store = writable(DEFAULT_SETTINGS as WereadPluginSettings);

	let _plugin!: WereadPlugin;

	const initialise = async (plugin: WereadPlugin): Promise<void> => {
		const data = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await plugin.loadData()
		);
		const settings: WereadPluginSettings = { ...data };
		if (settings.cookies.length > 1) {
			setUserName(settings.cookies);
		}
		store.set(settings);
		_plugin = plugin;
	};

	store.subscribe(async (settings) => {
		if (_plugin) {
			const data = {
				...settings
			};
			await _plugin.saveData(data);
		}
	});

	const clearCookies = () => {
		store.update((state) => {
			state.cookies = [];
			state.lastCookieTime = new Date().getTime();
			state.user = '';
			state.isCookieValid = false;
			return state;
		});
	};

	const setCookies = (cookies: Cookie[]) => {
		store.update((state) => {
			state.cookies = cookies;
			state.lastCookieTime = new Date().getTime();
			state.isCookieValid = true;
			setUserName(cookies);
			return state;
		});
	};

	const setCookieFlag = (flag: boolean) => {
		store.update((state) => {
			state.isCookieValid = true;
			return state;
		});
	};

	const setUserName = (cookies: Cookie[]) => {
		const userName = cookies.find(
			(cookie) => cookie.name == 'wr_name'
		).value;
		if (userName !== '') {
			console.log('setting user name=>', userName);
			store.update((state) => {
				state.user = userName;
				return state;
			});
		}
	};

	const setNoteLocationFolder = (value: string) => {
		store.update((state) => {
			state.noteLocation = value;
			return state;
		});
	};

	return {
		subscribe: store.subscribe,
		initialise,
		actions: {
			setNoteLocationFolder,
			setCookies,
			clearCookies,
			setCookieFlag
		}
	};
};

export const settingsStore = createSettingsStore();
