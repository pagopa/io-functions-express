import axios from "axios";
import { ChildProcess, spawn } from "child_process";

let spawnedFunc: ChildProcess;
let funcAddress: string;
let isStopping = false;

// do not reject promise on non-200 statuses
axios.defaults.validateStatus = () => true;

const startFunc = () =>
  // tslint:disable-next-line: promise-must-complete
  new Promise<{ p: ChildProcess; address: string }>(res => {
    const func = spawn("func", ["start"]);
    func.stdout.on("data", data => {
      if (!isStopping) {
        console.log(`${data}`);
      }
      const matches = String(data).match(/Now listening on: ([^\s]+)/);
      if (matches && matches[1]) {
        res({
          address: matches[1],
          p: func
        });
      }
    });
  });

const stopFunc = (p: ChildProcess) => {
  isStopping = true;
  p.kill();
};

beforeAll(done => {
  startFunc()
    .then(({ p, address }) => {
      spawnedFunc = p;
      funcAddress = address;
      done();
    })
    .catch(_ => 0);
});

afterAll(() => stopFunc(spawnedFunc));

describe("Azure functions handler", () => {
  it("should handle a simple GET request", async () => {
    const result = await axios.get(`${funcAddress}/api/HttpTest/ping`);
    expect(result.status).toEqual(200);
    expect(result.data).toEqual("PONG");
  });

  it("should parse path params", async () => {
    const result = await axios.get(`${funcAddress}/api/HttpTest/path/foo`);
    expect(result.status).toEqual(200);
    expect(result.data).toEqual({ foo: "foo" });
  });

  it("should parse params of GET request", async () => {
    const result = await axios.get(
      `${funcAddress}/api/HttpTest/get?param1=param1`
    );
    expect(result.status).toEqual(200);
    expect(result.data).toEqual({
      query: { param1: "param1" }
    });
  });

  it("should parse params of POST request", async () => {
    const result = await axios.post(
      `${funcAddress}/api/HttpTest/post?param1=param1`,
      {
        data: "data"
      }
    );
    expect(result.status).toEqual(200);
    expect(result.data).toEqual({
      body: { data: "data" },
      query: { param1: "param1" }
    });
  });

  it("should handle 404 status", async () => {
    const result = await axios.get(
      `${funcAddress}/api/HttpTest/status?status=404`
    );
    expect(result.status).toEqual(404);
  });

  it("should handle 500 status", async () => {
    const result = await axios.get(
      `${funcAddress}/api/HttpTest/status?status=500`
    );
    expect(result.status).toEqual(500);
  });

  it("should parse and respond with custom headers", async () => {
    const result = await axios.get(`${funcAddress}/api/HttpTest/headers`, {
      headers: {
        "x-custom-header-in": "value"
      }
    });
    expect(result.status).toEqual(200);
    expect(result.data).toMatchObject({
      headers: { "x-custom-header-in": "value" }
    });
    expect(result.headers).toMatchObject({
      "x-custom-header-out": "value"
    });
  });
});