/**
 * @Author: chris
 * @Date:   2017-05-02T14:40:47+10:00
 * @Email:  chris@southbanksoftware.com
 * @Last modified by:   guiguan
 * @Last modified time: 2018-01-30T14:01:22+11:00
 */

import {
  getRandomPort,
  killMongoInstance,
  launchSingleInstance,
  generateMongoData
} from 'test-utils';
import Terminal from '../pageObjects/OutputTerminal';
import Output from '../pageObjects/Output';
import ConnectionProfile from '../pageObjects/Connection.js';
import { config, getApp } from '../helpers';

describe('output-terminal-test-suite', () => {
  // always config test suite
  config();
  let app;
  let browser;
  let mongoPort;
  let terminal;
  let output;
  let connection;

  beforeAll(async () => {
    mongoPort = getRandomPort();
    launchSingleInstance(mongoPort);
    generateMongoData(mongoPort, 'test', 'test', 500);
    return getApp().then((res) => {
      app = res;
      browser = app.client;
      mongoPort = getRandomPort();
      terminal = new Terminal(browser);
      connection = new ConnectionProfile(browser);
      output = new Output(browser);
      launchSingleInstance(mongoPort);
    });
  });

  afterAll(() => {
    killMongoInstance(mongoPort);
    if (app && app.isRunning()) {
      return app.stop();
    }
  });

  test('executes command in terminal', async () => {
    await connection.connectProfileByHostname({
      alias: 'Local' + mongoPort,
      hostName: 'localhost',
      port: mongoPort,
      database: 'test'
    });
    await output.setNewOutputCursor();
    await terminal.executeCommand('use test;');
    await browser.pause(100);
    const outputLines =
      (await output.getNewOutputLines())
      .replace(/\r?\n|\r/g, '');
    const expectedOutput = expect.stringMatching('use test;switched to db testdbKoda&gt;');
    expect(outputLines).toEqual(expectedOutput);
  });

  test('can use history', async () => {
    const command = 'use test';
    await terminal.executeCommand(command);
    await terminal.previousCommand();
    const terminalText = (await terminal.text)[0];
    expect(terminalText).toBe(command);
    await terminal.nextCommand();
    await terminal.nextCommand();
    const secondTerminalText = (await terminal.text)[0];
    expect(secondTerminalText).toBe('');
  });

  test('send command to editor', async () => {
    const command = 'db.test.find()';
    await terminal.enterText(command);
    await terminal.sendToEditor();
    // look for db
    await browser.waitForExist('.editorPanel .cm-db');
    // look for test
    await browser.waitForExist('.editorPanel .cm-variable');
    // look for find
    await browser.waitForExist('.editorPanel .cm-property');
  });
});
