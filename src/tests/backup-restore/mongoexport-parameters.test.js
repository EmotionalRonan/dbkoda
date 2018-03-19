/**
 * Test mongo export parameter selections
 *
 * Created by joey on 21/8/17.
 * @Last modified by:   guiguan
 * @Last modified time: 2018-01-30T13:57:46+11:00
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

import assert from 'assert';
import os from 'os';
import {
  generateMongoData,
  getRandomPort,
  killMongoInstance,
  launchSingleInstance
} from 'test-utils';
import ConnectionProfile from '../pageObjects/Connection';
import BackupRestore, { ParameterName, TreeActions } from '../pageObjects/BackupRestore';
import TreeAction from '../pageObjects/TreeAction';
import Editor from '../pageObjects/Editor';

import { config, getApp } from '../helpers';

describe('mongo restore test suite', () => {
  config({ setupFailFastTest: false });
  let mongoPort;
  let connectProfile;
  let browser;
  let bkRestore;
  let app;
  let dbName;
  let tree;
  let editor;

  const cleanup = () => {
    killMongoInstance(mongoPort);
    if (app && app.isRunning()) {
      return app.stop();
    }
  };

  beforeAll(async () => {
    mongoPort = getRandomPort();
    launchSingleInstance(mongoPort);
    process.on('SIGINT', cleanup);
    return getApp().then(async res => {
      dbName = 'testdump-' + getRandomPort();
      generateMongoData(mongoPort, dbName, 'testcol', 10);
      generateMongoData(mongoPort, dbName + '-multi', 'testcol1', 10);
      generateMongoData(mongoPort, dbName + '-multi', 'testcol2', 10);
      generateMongoData(mongoPort, dbName + '-multi', 'testcol3', 10);
      app = res;
      browser = app.client;
      connectProfile = new ConnectionProfile(browser);
      bkRestore = new BackupRestore(browser);
      tree = new TreeAction(browser);
      editor = new Editor(browser);
      await connectProfile.connectProfileByHostname({
        alias: 'test dump a database ' + mongoPort,
        hostName: 'localhost',
        database: 'admin',
        port: mongoPort
      });
    });
  });

  afterAll(() => {
    return cleanup();
  });

  afterEach(async () => {
    await bkRestore.closePanel();
    await tree.toogleExpandTreeNode(tree.databasesNodeSelector);
  });

  test('export a database for multiple collections to verify its parameter values', async () => {
    try {
      const params = {
        [ParameterName.pathInput]: 'data/test/dump',
        [ParameterName.pretty]: true,
        [ParameterName.allCollections]: false,
        [ParameterName.selectedCollections]: ['testcol1', 'testcol2'],
        [ParameterName.jsonArray]: true,
        [ParameterName.type]: 'csv',
        [ParameterName.noHeaderLine]: true,
        [ParameterName.fields]: '',
        [ParameterName.forceTableScan]: true,
        [ParameterName.assertExists]: true,
        [ParameterName.query]: '{name: "joey"}',
        [ParameterName.readPreference]: 'primaryPreferred',
        [ParameterName.skip]: 100,
        [ParameterName.limit]: 1000,
        [ParameterName.sort]: '1'
      };
      await bkRestore.openMongoBackupRestorePanel(
        ['Databases', dbName + '-multi'],
        TreeActions.EXPORT_COLLECTIONS,
        params
      );
      await browser.pause(1000);
      assert.equal(await bkRestore.getParameterValue(ParameterName.database), dbName + '-multi');
      assert.equal(await bkRestore.getParameterValue(ParameterName.allCollections), null);
      assert.equal(await bkRestore.getParameterValue(ParameterName.pathInput), 'data/test/dump');
      assert.equal(await bkRestore.getParameterValue(ParameterName.pretty), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.jsonArray), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.type), 'csv');
      assert.equal(await bkRestore.getParameterValue(ParameterName.noHeaderLine), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.fields), '');
      assert.equal(await bkRestore.getParameterValue(ParameterName.forceTableScan), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.assertExists), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.query), '{name: "joey"}');
      assert.equal(
        await bkRestore.getParameterValue(ParameterName.readPreference),
        'primaryPreferred'
      );
      assert.equal(await bkRestore.getParameterValue(ParameterName.skip), 100);
      assert.equal(await bkRestore.getParameterValue(ParameterName.limit), 1000);
      assert.equal(await bkRestore.getParameterValue(ParameterName.sort), '1');
      const cmd = await editor._getEditorContentsAsArray();
      assert.equal(cmd.length, 2);
      console.log('get command ', cmd);
      if (os.platform() === 'win32') {
        assert.equal(
          cmd[0],
          `mongoexport --host "localhost" --port "${mongoPort}" --db "${dbName}-multi" --collection "testcol1" --pretty --jsonArray --noHeaderLine --type "csv" -q "{name: \\"joey\\"}" --readPreference "primaryPreferred" --forceTableScan --skip "100" --limit "1000" --sort "1" --assertExists -o "data/test/dump\\testcol1.json" `
        );
        assert.equal(
          cmd[1],
          `mongoexport --host "localhost" --port "${mongoPort}" --db "${dbName}-multi" --collection "testcol2" --pretty --jsonArray --noHeaderLine --type "csv" -q "{name: \\"joey\\"}" --readPreference "primaryPreferred" --forceTableScan --skip "100" --limit "1000" --sort "1" --assertExists -o "data/test/dump\\testcol2.json" `
        );
      } else {
        assert.equal(
          cmd[0],
          `mongoexport --host "localhost" --port "${mongoPort}" --db "${dbName}-multi" --collection "testcol1" --pretty --jsonArray --noHeaderLine --type "csv" -q "{name: \\"joey\\"}" --readPreference "primaryPreferred" --forceTableScan --skip "100" --limit "1000" --sort "1" --assertExists -o "data/test/dump/testcol1.json" `
        );
        assert.equal(
          cmd[1],
          `mongoexport --host "localhost" --port "${mongoPort}" --db "${dbName}-multi" --collection "testcol2" --pretty --jsonArray --noHeaderLine --type "csv" -q "{name: \\"joey\\"}" --readPreference "primaryPreferred" --forceTableScan --skip "100" --limit "1000" --sort "1" --assertExists -o "data/test/dump/testcol2.json" `
        );
      }
    } catch (err) {
      console.error(err);
      assert.fail(true, false, err.message);
    }
  });

  test('export a database to verify its parameter values', async () => {
    try {
      const params = {
        [ParameterName.pathInput]: 'data/test/dump',
        [ParameterName.pretty]: true,
        [ParameterName.allCollections]: true,
        [ParameterName.jsonArray]: true,
        [ParameterName.noHeaderLine]: true,
        [ParameterName.fields]: '',
        [ParameterName.forceTableScan]: true,
        [ParameterName.assertExists]: true,
        [ParameterName.query]: '{name: "joey"}',
        [ParameterName.readPreference]: 'primaryPreferred',
        [ParameterName.skip]: 100,
        [ParameterName.limit]: 1000,
        [ParameterName.sort]: '1'
      };
      await bkRestore.openMongoBackupRestorePanel(
        ['Databases', dbName],
        TreeActions.EXPORT_COLLECTIONS,
        params
      );
      await browser.pause(1000);
      assert.equal(await bkRestore.getParameterValue(ParameterName.database), dbName);
      assert.equal(await bkRestore.getParameterValue(ParameterName.pathInput), 'data/test/dump');
      assert.equal(await bkRestore.getParameterValue(ParameterName.pretty), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.jsonArray), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.noHeaderLine), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.fields), '');
      assert.equal(await bkRestore.getParameterValue(ParameterName.forceTableScan), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.assertExists), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.query), '{name: "joey"}');
      assert.equal(
        await bkRestore.getParameterValue(ParameterName.readPreference),
        'primaryPreferred'
      );
      assert.equal(await bkRestore.getParameterValue(ParameterName.type), 'json');
      assert.equal(await bkRestore.getParameterValue(ParameterName.skip), 100);
      assert.equal(await bkRestore.getParameterValue(ParameterName.limit), 1000);
      assert.equal(await bkRestore.getParameterValue(ParameterName.sort), '1');
      const cmd = await editor._getEditorContentsAsString();
      if (os.platform() === 'win32') {
        assert.equal(
          cmd,
          `mongoexport --host "localhost" --port "${mongoPort}" --db "${dbName}" --collection "testcol" --pretty --jsonArray --noHeaderLine --type "json" -q "{name: \\"joey\\"}" --readPreference "primaryPreferred" --forceTableScan --skip "100" --limit "1000" --sort "1" --assertExists -o "data/test/dump\\testcol.json" `
        );
      } else {
        assert.equal(
          cmd,
          `mongoexport --host "localhost" --port "${mongoPort}" --db "${dbName}" --collection "testcol" --pretty --jsonArray --noHeaderLine --type "json" -q "{name: \\"joey\\"}" --readPreference "primaryPreferred" --forceTableScan --skip "100" --limit "1000" --sort "1" --assertExists -o "data/test/dump/testcol.json" `
        );
      }
    } catch (err) {
      console.error(err);
      assert.fail(true, false, err.message);
    }
  });

  test('export a collection to verify its parameter values', async () => {
    try {
      const params = {
        [ParameterName.pathInput]: 'data/test/dump',
        [ParameterName.pretty]: true,
        [ParameterName.jsonArray]: true,
        [ParameterName.noHeaderLine]: true,
        [ParameterName.fields]: '',
        [ParameterName.forceTableScan]: true,
        [ParameterName.assertExists]: true,
        [ParameterName.query]: '{name: "joey"}',
        [ParameterName.readPreference]: 'primaryPreferred',
        [ParameterName.type]: 'json',
        [ParameterName.skip]: 100,
        [ParameterName.limit]: 1000,
        [ParameterName.sort]: '1'
      };
      await bkRestore.openMongoBackupRestorePanel(
        ['Databases', dbName, 'testcol'],
        TreeActions.EXPORT_COLLECTION,
        params
      );
      await browser.pause(1000);
      assert.equal(await bkRestore.getParameterValue(ParameterName.database), dbName);
      assert.equal(await bkRestore.getParameterValue(ParameterName.pathInput), 'data/test/dump');
      assert.equal(await bkRestore.getParameterValue(ParameterName.collectionSelect), 'testcol');
      assert.equal(await bkRestore.getParameterValue(ParameterName.pretty), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.jsonArray), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.noHeaderLine), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.fields), '');
      assert.equal(await bkRestore.getParameterValue(ParameterName.forceTableScan), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.assertExists), 'true');
      assert.equal(await bkRestore.getParameterValue(ParameterName.query), '{name: "joey"}');
      assert.equal(
        await bkRestore.getParameterValue(ParameterName.readPreference),
        'primaryPreferred'
      );
      assert.equal(await bkRestore.getParameterValue(ParameterName.type), 'json');
      assert.equal(await bkRestore.getParameterValue(ParameterName.skip), 100);
      assert.equal(await bkRestore.getParameterValue(ParameterName.limit), 1000);
      assert.equal(await bkRestore.getParameterValue(ParameterName.sort), '1');
      const cmd = await editor._getEditorContentsAsString();
      if (os.platform() === 'win32') {
        assert.equal(
          cmd,
          `mongoexport --host "localhost" --port "${mongoPort}" --db "${dbName}" --collection "testcol" --pretty --jsonArray --noHeaderLine --type "json" -q "{name: \\"joey\\"}" --readPreference "primaryPreferred" --forceTableScan --skip "100" --limit "1000" --sort "1" --assertExists -o "data/test/dump\\testcol.json" `
        );
      } else {
        assert.equal(
          cmd,
          `mongoexport --host "localhost" --port "${mongoPort}" --db "${dbName}" --collection "testcol" --pretty --jsonArray --noHeaderLine --type "json" -q "{name: \\"joey\\"}" --readPreference "primaryPreferred" --forceTableScan --skip "100" --limit "1000" --sort "1" --assertExists -o "data/test/dump/testcol.json" `
        );
      }
    } catch (err) {
      console.error(err);
      assert.fail(true, false, err.message);
    }
  });
});
