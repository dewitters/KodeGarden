let syntax = {
	// Set defaultToken to invalid to see what you do not tokenize yet
	// defaultToken: 'invalid',
	keywords: [
		'try', 'catch', 'throw', 'if', 'return', 'while', 'for',
		'return', 'break', 'case', 'default', 'continue', 'do',
		'while', 'for', 'switch', 'if', 'else', '...', 'cast',
		'untyped', 'trace', 'this', 'super', 'new', 'var',
		'function', 'abstract', 'class', 'enum', 'interface', 'typedef',
		'from', 'to', 'default', 'get', 'set', 'dynamic', 'never', 'null',
		'public', 'private', 'static', 'dynamic', 'inline', 'macro', 'extern', 'override',
		'import', 'package'
	],
	typeKeywords: [
		'Bool', 'Float', 'Int'
	],
	operators: [
		'=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
		'&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
		'<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
		'%=', '<<=', '>>=', '>>>='
	],
	// we include these common regular expressions
	symbols:  /[=><!~?:&|+\-*\/\^%]+/,
	// C# style strings
	escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
	// The main tokenizer for our languages
	tokenizer: {
		root: [
			// identifiers and keywords
			[/[a-z_$][\w$]*/, { cases: { '@typeKeywords': 'keyword',
				'@keywords': 'keyword',
				'@default': 'identifier' } }],
			[/[A-Z][\w\$]*/, 'type.identifier' ],  // to show class names nicely
			// whitespace
			{ include: '@whitespace' },
			// delimiters and operators
			[/[{}()\[\]]/, '@brackets'],
			[/[<>](?!@symbols)/, '@brackets'],
			[/@symbols/, { cases: { '@operators': 'operator',
				'@default'  : '' } } ],
			// @ annotations.
			// As an example, we emit a debugging log message on these tokens.
			// Note: message are supressed during the first load -- change some lines to see them.
			[/@\s*[a-zA-Z_\$][\w\$]*/, { token: 'annotation', log: 'annotation token: $0' }],
			// numbers
			[/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
			[/0[xX][0-9a-fA-F]+/, 'number.hex'],
			[/\d+/, 'number'],
			// delimiter: after number because of .\d floats
			[/[;,.]/, 'delimiter'],
			// strings: recover on non-terminated strings
			[/"([^"\\]|\\.)*$/, 'string.invalid' ],  // non-teminated string
			[/'([^'\\]|\\.)*$/, 'string.invalid' ],  // non-teminated string
			[/"/,  'string', '@string."' ],
			[/'/,  'string', '@string.\'' ],
			// characters
			[/'[^\\']'/, 'string'],
			[/(')(@escapes)(')/, ['string','string.escape','string']],
			[/'/, 'string.invalid']
		],
		comment: [
			[/[^\/*]+/, 'comment' ],
			[/\/\*/,    'comment', '@push' ],    // nested comment
			["\\*/",    'comment', '@pop'  ],
			[/[\/*]/,   'comment' ]
		],
		string: [
			[/[^\\"']+/, 'string'],
			[/@escapes/, 'string.escape'],
			[/\\./,      'string.escape.invalid'],
			[/["']/,     { cases: { '$#==$S2' : { token: 'string', next: '@pop' },
				'@default': 'string' }} ]
		],
		whitespace: [
			[/[ \t\r\n]+/, 'white'],
			[/\/\*/,       'comment', '@comment' ],
			[/\/\/.*$/,    'comment'],
		],
	},
};

declare var require: any;
declare var monaco: any;

require.config({ paths: { 'vs': 'node_modules/monaco-editor/min/vs' }});
require(['domReady', 'vs/editor/editor.main'], function (domReady) {
	domReady(function () {
		let sha = 'start';
		if (window.location.hash.length > 1) {
			sha = window.location.hash.substr(1);
		}

		let khaframe = document.getElementById('application') as HTMLIFrameElement;
		khaframe.contentWindow.location.replace('/projects/' + sha + '/');

		monaco.languages.register({ id: 'haxe' });
		monaco.languages.setMonarchTokensProvider('haxe', syntax);
		let editordiv = document.getElementById('texteditor');
		let editor = monaco.editor.create(editordiv, {
			value: '',
			language: 'haxe',
			theme: 'vs-dark'
		});

		window.onresize = () => {
			editor.layout({ width: window.innerWidth / 2, height: editordiv.clientHeight });
		};

		let connection = new WebSocket('ws://' + window.location.host + '/');
		connection.onopen = () => {
			document.getElementById('compile').onclick = () => {
				document.getElementById('compilemessage').textContent = ' Compiling...';
				let console = document.getElementById('console');
				while (console.firstChild) {
					console.removeChild(console.firstChild);
				}
				connection.send(JSON.stringify({ method: 'compile', data: { source: editor.getValue() } }));
			};
			connection.send(JSON.stringify({ method: 'getSource', data: { sha: sha } }));
		};

		connection.onerror = (error) => {
			console.error('Could not connect to socket. ' + error);
		};

		function addConsoleMessage(message, error) {
			let console = document.getElementById('console');
			let messages = message.trim().split('\n');
			for (let message of messages) {
				let span = document.createElement('span');
				span.textContent = message;
				if (error) span.style.color = '#cc1111';
				console.appendChild(span);
				console.appendChild(document.createElement('br'));
			}
		}

		connection.onmessage = (e) => {
			let message = JSON.parse(e.data);
			switch (message.method) {
				case 'compiled':
					document.getElementById('compilemessage').textContent = ' Compiled.';
					console.log('Reloading Kha.');
					(document.getElementById('application') as HTMLIFrameElement).contentWindow.location.replace('/projects/' + message.data.sha + '/');
					window.location.hash = '#' + message.data.sha;
					break;
				case 'errored':
					document.getElementById('compilemessage').textContent = ' Errored.';
					break;
				case 'source':
					editor.setValue(message.data.source);
					break;
				case 'compilation-message':
					addConsoleMessage(message.data.message, false);
					break;
				case 'compilation-error':
					addConsoleMessage(message.data.message, true);
					break;
			}
		};
	});
});
