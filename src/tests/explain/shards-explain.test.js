/**
 * @Last modified by:   guiguan
 * @Last modified time: 2018-01-30T14:00:43+11:00
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

/**
 * Created by joey on 24/5/17.
 */
import assert from 'assert';
import uuidV1 from 'uuid/v1';
import { getRandomPort, killMongoInstance, launchMongoInstance, generateMongoData } from 'test-utils';

import ConnectionProfile from '../pageObjects/Connection';
import Editor from '../pageObjects/Editor';
import Explain from '../pageObjects/Explain';

import { getApp, config } from '../helpers';

/* eslint-disable  no-await-in-loop */

describe('test explain', () => {
  // always config test suite
  config({ setupFailFastTest: false });
  let app;
  let browser;
  let mongoPort;
  let connectProfile;
  let editor;
  let explain;

  const cleanup = async() => {
    killMongoInstance(mongoPort);
    if (app && app.isRunning()) {
      return app.stop();
    }
  };

  beforeAll(async(done) => {
    mongoPort = getRandomPort();
    launchMongoInstance('--replicaset', mongoPort, '--mongos 3 --sharded 3 --hostname localhost');
    setTimeout(() => {
      generateMongoData(mongoPort, 'test', 'users', 500);
      process.on('SIGINT', cleanup);
      return getApp().then(async(res) => {
        app = res;
        browser = app.client;
        await browser.pause(10000);
        connectProfile = new ConnectionProfile(browser);
        explain = new Explain(browser);
        editor = new Editor(browser);
        const alias = 'connection:' + uuidV1();
        return connectProfile.connectProfileByURL({
          alias,
          url: 'mongodb://localhost:' + mongoPort,
          database: 'test'
        });
      }).then(async() => {
        await editor._appendToEditor('use admin;\n');
        await editor._appendToEditor('db.runCommand({enableSharding: "test"});\n');
        await editor._appendToEditor('use test;\n');
        await editor._appendToEditor('db.users.createIndex({"user.age":1});\n');
        await editor._clickExecuteAll();
        console.log('finish before all');
        done();
      });
    }, 120000);
  });

  afterAll(() => {
    return cleanup();
  });

  test('run explain query on a shard cluster', async() => {
    try {
      await editor._clearEditor();
      await editor._appendToEditor('\n use test;\n');
      await editor._clickExecuteAll();
      await editor._appendToEditor('db.users.find();');
      await browser.pause(2500);
      await editor.clickExplainExecutionStats();
      await browser.pause(1000);
      const stages = await explain.getNumberOfStages();
      console.log(`Stages: ${stages}`);
      assert.equal(stages, 2);
      const stage1 = await explain.getStageText(0);
      console.log(`Stage 1: ${stage1}`);
      assert.equal(stage1, 'COLLSCAN');
      const stage2 = await explain.getStageText(1);
      console.log(`Stage 2: ${stage2}`);
      assert.equal(stage2, 'SINGLE_SHARD');
      const detailData = await explain.getExplainDetailTableData(true);
      assert.equal(detailData.length, 2);
      assert.equal(detailData[0].name, 'COLLSCAN');
      const statistics = await explain.getShardsStatisticTableData();
      assert.equal(statistics.length, 1);
      assert.equal(statistics[0].name, 'shard01');
    } catch (err) {
      console.error(err);
      assert.fail(true, false, err);
    }
  });

  test('shard collection and execute explain', async() => {
    try {
      await editor._clearEditor();
      await editor._appendToEditor('use admin;\n');
      await editor._appendToEditor('db.runCommand( { shardCollection: "test.users", key: { "user.age": 1 } } );\n');
      await editor._clickExecuteAll();
      await browser.pause(1000);
      await editor._appendToEditor('sh.splitAt("test.users", {"user.age":30});\n');
      await editor._appendToEditor('sh.splitAt("test.users", {"user.age":60});\n');
      await editor._appendToEditor('sh.moveChunk("test.users", {"user.age":20}, "shard02");\n');
      await editor._appendToEditor('sh.moveChunk("test.users", {"user.age":60}, "shard03");\n');
      await editor._appendToEditor('\n use test;\n');
      await editor._clickExecuteAll();
      await browser.pause(15000);
      await editor._appendToEditor('db.users.find({"user.age": {$gt: 10}});');
      await browser.pause(1000);
      await editor.clickExplainExecutionStats();
      await browser.pause(5000);
      const stages = await explain.getNumberOfStages();
      assert.equal(stages, 10);
      for (let i = 0; i < 3; i += 1) {
        const stagesText = await explain.getStageText(i);
        assert.equal(stagesText.length, 3);
        assert.equal(stagesText[0], 'IXSCAN');
        assert.equal(stagesText[1], 'SHARDING_FILTER');
        assert.equal(stagesText[2], 'FETCH');
      }
      const detailData = await explain.getExplainDetailTableData(true);
      console.log('detail data', detailData);
      assert.equal(detailData.length, 4);
      const statistics = await explain.getShardsStatisticTableData();
      console.log('shard data', statistics);
      assert.equal(statistics.length, 3);
    } catch (err) {
      console.error(err);
      assert.fail(true, false, err);
    }
  });
});
