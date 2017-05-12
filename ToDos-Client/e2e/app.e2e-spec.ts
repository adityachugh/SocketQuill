import { ToDosClientPage } from './app.po';

describe('to-dos-client App', () => {
  let page: ToDosClientPage;

  beforeEach(() => {
    page = new ToDosClientPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
