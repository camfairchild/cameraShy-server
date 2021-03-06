import dotenv from "dotenv";
dotenv.config();
import axios from 'axios';

export async function sendOSnotif(osId, header, content, data) {
  if (process.env.DEV) {
    return;
  }
  const endpoint = "https://onesignal.com/api/v1/notifications";
  const app_id = process.env.ONESIGNAL_APP;
  const os_key = process.env.ONESIGNAL_KEY;
  await axios({
    method: "post",
    url: endpoint,
    data: {
      app_id: app_id,
      include_player_ids: [osId],
      contents: { "en": content },
      headings: { "en": header },
      data: data
    },
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": "Basic " + os_key
    },
  })
    .then(function (response) {
      console.log("Status text: " + response.status);
      console.log("Status text: " + response.statusText);
      console.log();
      console.log(response.data);
    })
    .catch(function (error) {
      console.log(error);
    });
}