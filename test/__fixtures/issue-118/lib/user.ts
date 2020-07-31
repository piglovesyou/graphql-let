export class User {
  id: string;
  name: string;
  status: string;

  constructor(id: string, name: string, status: string) {
    this.id = id;
    this.name = name;
    this.status = status;
  }
}
