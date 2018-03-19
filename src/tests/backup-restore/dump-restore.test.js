/**
 * Created by joey on 17/8/17.
 * @Date:   2018-01-23T14:49:56+11:00
 * @Email:  root@guiguan.net
 * @Last modified by:   guiguan
 * @Last modified time: 2018-01-30T13:56:11+11:00
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
import {
  getRandomPort,
  killMongoInstance,
  launchSingleInstance,
  generateMongoData
} from 'test-utils';
import ConnectionProfile from '../pageObjects/Connection';
import BackupRestore, { ParameterName } from '../pageObjects/BackupRestore';
import TreeAction from '../pageObjects/TreeAction';
import Tree from '../pageObjects/Tree';

import { getApp, config } from '../helpers';

describe('backup restore test suite', () => {
  config({ setupFailFastTest: false });
  let mongoPort;
  let connectProfile;
  let browser;
  let bkRestore;
  let app;
  let treeAction;
  let tree;

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
      app = res;
      browser = app.client;
      connectProfile = new ConnectionProfile(browser);
      bkRestore = new BackupRestore(browser);
      treeAction = new TreeAction(browser);
      tree = new Tree(browser);

      await connectProfile.connectProfileByHostname({
        alias: 'test backup ' + mongoPort,
        hostName: 'localhost',
        database: 'admin',
        port: mongoPort
      });
      await browser.pause(3000);
    });
  });

  afterAll(() => {
    return cleanup();
  });

  test('dump and restore a single database without any parameters', async () => {
    const dumpDbName = 'testdump-' + getRandomPort();
    const restoreDbName = 'testrestore-' + getRandomPort();
    generateMongoData(mongoPort, dumpDbName, 'testcol', 500);
    generateMongoData(mongoPort, restoreDbName, 'placeholder');
    await tree._clickRefreshButton();
    await browser.pause(1000);
    await bkRestore.dumpDatabase(dumpDbName, {
      [ParameterName.pathInput]: 'data/test/dump',
      [ParameterName.gzip]: false
    });
    await bkRestore.restoreDatabase(restoreDbName, {
      [ParameterName.pathInput]: `data/test/dump/${dumpDbName}/testcol.bson`
    });
    await tree._clickRefreshButton();
    // TODO: verify the restored database
    const nodes = await treeAction.getTreeNodeByPath(['Databases', restoreDbName, 'testcol']);
    console.log('get tree nodes ', nodes);
    assert.notEqual(nodes, null);
  });

  test('dump and restore multiple databases', async () => {
    const dumpDbName = 'testdump-' + getRandomPort();
    generateMongoData(mongoPort, dumpDbName + '1', 'testcol1', 500);
    generateMongoData(mongoPort, dumpDbName + '2', 'testcol2', 500);
    generateMongoData(mongoPort, dumpDbName + '3', 'testcol3', 500);
    await tree._clickRefreshButton();
    await browser.pause(1000);
    await bkRestore.dumpServerDatabases([dumpDbName + '1', dumpDbName + '2', dumpDbName + '3'], {
      [ParameterName.pathInput]: 'data/test/dump'
    });
    // restore the dump data into a new database
    await bkRestore.restoreDatabase('restoreDb1', {
      [ParameterName.pathInput]: `data/test/dump/${dumpDbName}1/testcol1.bson`
    });
    await bkRestore.restoreDatabase('restoreDb2', {
      [ParameterName.pathInput]: `data/test/dump/${dumpDbName}2/testcol2.bson`
    });
    await bkRestore.restoreDatabase('restoreDb3', {
      [ParameterName.pathInput]: `data/test/dump/${dumpDbName}3/testcol3.bson`
    });
    await tree._clickRefreshButton();
    await browser.pause(5000);
    await tree.toogleExpandTreeNode(tree.databasesNodeSelector);
    // TODO: verify the restored database
    let nodes = await treeAction.getTreeNodeByPath(['Databases', 'restoreDb1', 'testcol1']);
    assert.notEqual(nodes, null);
    nodes = await treeAction.getTreeNodeByPath(['Databases', 'restoreDb2', 'testcol2']);
    assert.notEqual(nodes, null);
    nodes = await treeAction.getTreeNodeByPath(['Databases', 'restoreDb3', 'testcol3']);
    assert.notEqual(nodes, null);
  });

  test('dump and restore a collection', async () => {
    const dumpDbName = 'testdump-' + getRandomPort();
    generateMongoData(mongoPort, dumpDbName, 'testcol1', 10);
    await tree._clickRefreshButton();
    await browser.pause(1000);
    await bkRestore.dumpCollection(dumpDbName, 'testcol1', {
      [ParameterName.pathInput]: 'data/test/dump'
    });
    await bkRestore.restoreCollection(dumpDbName, 'testcol1', {
      [ParameterName.pathInput]: `data/test/dump/${dumpDbName}/testcol1.bson`,
      [ParameterName.drop]: true
    });
    await tree._clickRefreshButton();
    await browser.pause(5000);
    await tree.toogleExpandTreeNode(tree.databasesNodeSelector);
    await treeAction.getTreeNodeByPath(['Databases', dumpDbName]).leftClick();
    // TODO: verify the restored database
    const nodes = await treeAction.getTreeNodeByPath(['Databases', dumpDbName, 'testcol1']);
    assert.notEqual(nodes, null);
  });
  /*
  test('dump and restore multiple collections', async () => {
    const dumpDbName = 'testdump-' + getRandomPort();
    const restoreDbName = 'restore-' + getRandomPort();
    generateMongoData(mongoPort, dumpDbName, 'testcol1', 10);
    generateMongoData(mongoPort, dumpDbName, 'testcol2', 10);
    generateMongoData(mongoPort, dumpDbName, 'testcol3', 10);
    generateMongoData(mongoPort, restoreDbName, 'test', 10);
    await tree._clickRefreshButton();
    await browser.pause(1000);
    await bkRestore.dumpDatabaseCollections(dumpDbName, ['testcol1', 'testcol2', 'testcol3'], {[ParameterName.pathInput]: 'data/test/dump'});
    await bkRestore.restoreDatabaseCollections(restoreDbName, {
      [ParameterName.pathInput]: `data/test/dump/${dumpDbName}/testcol1.bson`,
    });
    await bkRestore.restoreDatabaseCollections(restoreDbName, {
      [ParameterName.pathInput]: `data/test/dump/${dumpDbName}/testcol2.bson`,
    });
    await bkRestore.restoreDatabaseCollections(restoreDbName, {
      [ParameterName.pathInput]: `data/test/dump/${dumpDbName}/testcol3.bson`,
    });
    await tree._clickRefreshButton();
    await browser.pause(5000);
    await tree.toogleExpandTreeNode(
      tree.databasesNodeSelector
    );
    // TODO: verify the restored database
    let nodes = await treeAction.getTreeNodeByPath(['Databases', restoreDbName, 'testcol1']);
    assert.notEqual(nodes, null);
    nodes = await treeAction.getTreeNodeByPath(['Databases', restoreDbName, 'testcol2']);
    assert.notEqual(nodes, null);
    nodes = await treeAction.getTreeNodeByPath(['Databases', restoreDbName, 'testcol3']);
    assert.notEqual(nodes, null);
  });
*/
});
