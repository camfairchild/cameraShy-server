import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  id: string,
  osId: string,
  socketId: string,
  personId: string,
  name: string,
  lastCoords: {
    lat: number,
    long: number,
  },
  imageUrl: string
}

const UserSchema: Schema = new Schema({
  id: String,
  osId: String,
  socketId: String,
  personId: String,
  name: String,
  lastCoords: {
    lat: Number,
    long: Number,
  },
  imageUrl: String
});

export default mongoose.model<IUser>("User", UserSchema);