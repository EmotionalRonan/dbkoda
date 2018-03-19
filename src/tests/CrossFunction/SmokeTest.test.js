/**
 * @Last modified by:   guiguan
 * @Last modified time: 2018-01-30T13:58:43+11:00
 *
 * dbKoda - a modern, open source code editor, for MongoDB.
 * Copyright (C) 2017-2018 Southbank Software
 *
 * This file is part of dbKoda.
 *
 * dbKoda is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * dbKoda is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with dbKoda.  If not, see <http://www.gnu.org/licenses/>.
 */

import _ from 'lodash';
import {
  getRandomPort,
  killMongoInstance,
  launchSingleInstance,
  generateMongoData
} from 'test-utils';
import TreeAction from '#/pageObjects/TreeAction';
import Connection from '#/pageObjects/Connection';
import AggregateBuilder from '#/pageObjects/AggregateBuilder';
import Editor from '#/pageObjects/Editor';
import Output from '#/pageObjects/Output';
import ProfileList from '#/pageObjects/ProfileList';
import Terminal from '#/pageObjects/OutputTerminal';
import { config, getApp } from '#/helpers';

const PROMPT_LENGTH = 10;

describe('Smoke Test', () => {
  /** Global (to current test suite) setup */
  config({ setupFailFastTest: false });

  /** Global (to current test suite) vars */
  const r = {};
  r.delay = 5000; // Set higher to make sure that tests don't fail on slow cloud
  const cleanupWorkflows = [];

  const cleanup = async () => {
    // cleanup in reverse order
    await _.reduceRight(
      cleanupWorkflows,
      async (acc, wf) => {
        await acc;
        try {
          await wf();
        } catch (e) {
          console.error(e.stack);
        }
      },
      Promise.resolve()
    );
  };

  beforeAll(async () => {
    try {
      const app = await getApp();

      r.app = app;
      r.browser = app.client;
      r.aggregate = new AggregateBuilder(r.browser);
      r.treeAction = new TreeAction(r.browser);
      r.connection = new Connection(r.browser);
      r.output = new Output(r.browser);
      r.editor = new Editor(r.browser);
      r.profileList = new ProfileList(r.browser);
      r.terminal = new Terminal(r.browser);
      r.debug = async () => {
        console.log('\n\nWebdriverIO debugging REPL...');
        await r.browser.debug();
      };
      global.debug = r.debug;
      r.mongoPort1 = getRandomPort();
      launchSingleInstance(r.mongoPort1);
      generateMongoData(r.mongoPort1, 'test', 'test', 500);
      r.mongoPort2 = getRandomPort();
      launchSingleInstance(r.mongoPort2);
      generateMongoData(r.mongoPort2, 'test', 'test', 500);

      cleanupWorkflows.push(async () => {
        if (app && app.isRunning()) {
          await app.stop();
        }
      });
    } catch (error) {
      test.error = error;
    }
  });

  afterAll(async () => {
    killMongoInstance(r.mongoPort1);
    await cleanup();
  });

  /** Setup database */

  test('Setup globals', async () => {
    r.ec2 = process.env.EC2_SHARD_CLUSTER_HOSTNAME;
  });

  /** Connect to database */
  test('Open A New Connection', async () => {
    try {
      await r.browser.pause(500);
      await r.connection.connectProfileByHostname({
        alias: 'Test1',
        hostName: 'localhost',
        port: r.mongoPort1,
        database: 'test'
      });
      expect(true).toBe(true);
    } catch (error) {
      console.log(error);
      expect(false).toBe(true);
    }
  });

  test('Execute A Basic Command', async () => {
    try {
      await r.editor._appendToEditor(
        'use test\nfor (var i=2000;i<2020;i+=1) { db.companies.insertOne({name:"company"+i,founded_year:i,});\n db.companies.insertOne({name:"company2"+i,founded_year:i,}); };\n'
      );
      await r.browser.pause(500);
      await r.editor._clickExecuteAll();
      await r.browser.pause(500);
      await r.browser.element('.refreshTreeButton').click();
      expect(true).toBe(true);
    } catch (error) {
      console.log(error);
      expect(false).toBe(true);
    }
  });

  test('Tree can Update', async () => {
    try {
      await r.treeAction
        .getTreeNodeByPath(['Databases', 'test', 'companies'])
        .pause(500);
      expect(true).toBe(true);
    } catch (error) {
      console.log(error);
      expect(false).toBe(true);
    }
  });

  test('Output and show more on large query.', async () => {
    await r.output.setNewOutputCursor();
    await r.editor._appendToEditor('use test;\n');
    await r.editor._appendToEditor('db.companies.find();\n');
    await r.editor._clickExecuteAll();
    // TODO A better way of waiting for execution completion
    await r.browser.pause(1000);
    let outputLines = await r.output.getNewOutputLines();
    const showMoreDisabled = await r.output._isShowMoreDisabled();
    expect(showMoreDisabled).toBe(false);
    await r.output.setNewOutputCursor();
    await r.output.showMore.leftClick();
    // TODO A better way of waiting for execution completion
    await r.browser.pause(1000);
    outputLines = await r.output.getNewOutputLines();
    expect(outputLines.length).toBeGreaterThan(PROMPT_LENGTH);
  });

  test('Clear output button.', async () => {
    await r.output.clearOutput.leftClick();
    const outputLines = await r.output.getAllOutputLines();
    expect(outputLines).toBe('');
  });

  test('Creating a second connection.', async () => {
    try {
      await r.browser.pause(500);
      await r.connection.connectProfileByHostname({
        alias: 'Test2',
        hostName: 'localhost',
        port: r.mongoPort2,
        database: 'test'
      });
    } catch (error) {
      console.error(error);
      expect(false).toBe(true);
    }
    expect(true).toBe(true);
  });

  test('Swapping Profiles', async () => {
    try {
      await r.profileList.clickProfile(0);
      await r.browser.waitForExist(r.treeAction.treeNodeSelector);
      const outputLines = await r.output.getAllOutputLines();
      expect(outputLines).toBe('');
      expect(true).toBe(true);
    } catch (error) {
      console.error(error);
      expect(false).toBe(true);
    }
  });
});
