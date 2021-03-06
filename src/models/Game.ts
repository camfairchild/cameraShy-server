import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User";

export interface IGame extends Document {
  id: string,
  host: IUser['_id'],
  lat: number,
  long: number,
  rad: number,
  bound: [number],
  timeLimit: number,
  memberLimit: number,
  players: [IUser['_id']]
}

const GameSchema: Schema = new Schema({
  id: String,
  host: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  lat: Number,
  long: Number,
  rad: Number,
  bound: [Number],
  timeLimit: Number,
  memberLimit: Number,
  players: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
});

export default mongoose.model<IGame>("Game", GameSchema);