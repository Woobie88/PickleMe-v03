function toggleAddPlayersFabMenu() {
  const menu = document.getElementById('add-players-fab-menu');
  const plusIcon = document.getElementById('add-players-plus-icon');
  const xIcon = document.getElementById('add-players-x-icon');
  const label = document.getElementById('add-players-main-label');

  const isOpen = menu.classList.toggle('open');

  plusIcon.style.display = isOpen ? 'none' : 'block';
  xIcon.style.display = isOpen ? 'block' : 'none';
  label.style.display = isOpen ? 'none' : 'block';
}

function handleAddPlayersAction(action) {
  toggleAddPlayersFabMenu(); // close the menu after a selection

  switch (action) {
    case 'opensports':
      console.log('OpenSports import selected');
      // next: navigate to the OpenSports OCR flow screen
      break;
    case 'individual':
      console.log('Individual add selected');
      // next: navigate to the manual single-player form screen
      break;
  }
}
