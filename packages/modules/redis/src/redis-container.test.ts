import fs from "fs";
import os from "os";
import path from "path";
import { createClient } from "redis";
import { RedisContainer, StartedRedisContainer } from "./redis-container";

const IMAGE = "redis:7.2";

describe("RedisContainer", { timeout: 240_000 }, () => {
  // startContainer {
  it("should connect and execute set-get", async () => {
    const container = await new RedisContainer(IMAGE).start();

    const client = await connectTo(container);

    await client.set("key", "val");
    expect(await client.get("key")).toBe("val");

    client.destroy();
    await container.stop();
  });
  // }

  it("should connect with password and execute set-get", async () => {
    const container = await new RedisContainer(IMAGE).withPassword("test").start();

    const client = await connectTo(container);

    await client.set("key", "val");
    expect(await client.get("key")).toBe("val");

    client.destroy();
    await container.stop();
  });

  // persistentData {
  it("should reconnect with volume and persistence data", async () => {
    const sourcePath = fs.mkdtempSync(path.join(os.tmpdir(), "redis-"));
    const container = await new RedisContainer(IMAGE).withPassword("test").withPersistence(sourcePath).start();
    let client = await connectTo(container);

    await client.set("key", "val");
    client.destroy();
    await container.restart();
    client = await connectTo(container);
    expect(await client.get("key")).toBe("val");

    client.destroy();
    await container.stop();
    try {
      fs.rmSync(sourcePath, { force: true, recursive: true });
    } catch (e) {
      //Ignore clean up, when have no access on fs.
      console.log(e);
    }
  });
  // }

  // initial data import {
  it("should load initial data and can read it", async () => {
    const container = await new RedisContainer(IMAGE)
      .withPassword("test")
      .withInitialData(path.join(__dirname, "initData.redis"))
      .start();
    const client = await connectTo(container);
    const user = {
      first_name: "David",
      last_name: "Bloom",
      dob: "03-MAR-1981",
    };
    expect(await client.get("user:002")).toBe(JSON.stringify(user));

    client.destroy();
    await container.stop();
  });
  // }

  // startWithCredentials {
  it("should start with credentials and login", async () => {
    const password = "testPassword";

    // Test authentication
    const container = await new RedisContainer(IMAGE).withPassword(password).start();
    expect(container.getConnectionUrl()).toEqual(`redis://:${password}@${container.getHost()}:${container.getPort()}`);

    const client = await connectTo(container);

    await client.set("key", "val");
    expect(await client.get("key")).toBe("val");

    client.destroy();
    await container.stop();
  });
  // }

  // executeCommand {
  it("should execute container cmd and return the result", async () => {
    const container = await new RedisContainer(IMAGE).start();

    const queryResult = await container.executeCliCmd("info", ["clients"]);
    expect(queryResult).toEqual(expect.stringContaining("connected_clients:1"));

    await container.stop();
  });
  // }

  // startWithRedisStack {
  it("should start with redis-stack-server and json module", async () => {
    const container = await new RedisContainer("redis/redis-stack-server:7.4.0-v4")
      .withPassword("testPassword")
      .start();
    const client = await connectTo(container);

    await client.json.set("key", "$", { name: "test" });
    const result = await client.json.get("key");
    expect(result).toEqual(JSON.stringify({ name: "test" }));

    client.destroy();
    await container.stop();
  });
  // }

  // simpleConnect {
  async function connectTo(container: StartedRedisContainer) {
    const client = createClient({
      url: container.getConnectionUrl(),
    });
    await client.connect();
    expect(client.isOpen).toBeTruthy();
    return client;
  }
  // }
});
